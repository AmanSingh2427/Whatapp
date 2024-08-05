import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import moment from 'moment';

const socket = io('http://localhost:5000'); // Replace with your server URL

const Chat = ({ selectedUserId, selectedGroupId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const extractUserDetailsFromToken = () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decodedToken = JSON.parse(atob(token.split('.')[1])); // Decode JWT token payload
          return { userId: decodedToken.userId, userName: decodedToken.userName }; // Update based on the actual token structure
        } catch (e) {
          console.error('Error decoding token:', e);
        }
      }
      return { userId: null, userName: '' };
    };
    

    const { userId, userName } = extractUserDetailsFromToken();
    setUserId(userId);
    setUserName(userName);

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          setLoading(false);
          return;
        }

        if (selectedUserId) {
          const response = await axios.get(`http://localhost:5000/api/messages/${selectedUserId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          setMessages(response.data);
        } else if (selectedGroupId) {
          const response = await axios.get(`http://localhost:5000/api/groups/${selectedGroupId}/messages`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          setMessages(response.data);
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          setMessages([]); // No messages found, initialize as empty array
        } else {
          console.error('Error fetching messages:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    if (selectedUserId || selectedGroupId) {
      fetchMessages();
    }

    return () => {
      socket.off('newMessage');
    };
  }, [selectedUserId, selectedGroupId]);

  useEffect(() => {
    const handleNewMessage = (message) => {
      if (selectedUserId) {
        if (
          (message.sender_id === userId && message.receiver_id === selectedUserId) ||
          (message.sender_id === selectedUserId && message.receiver_id === userId)
        ) {
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      } else if (selectedGroupId) {
        if (message.group_id === selectedGroupId) {
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      }
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [userId, selectedUserId, selectedGroupId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() && (selectedUserId || selectedGroupId)) {
      setInputMessage('');
      console.log('Send message function triggered'); // Ensure this is logged
  
      try {
        const token = localStorage.getItem('token');
        console.log('Token:', token); // Log the token
  
        let response;
        if (selectedUserId) {
          response = await axios.post(
            'http://localhost:5000/api/messages',
            { receiverId: selectedUserId, message: inputMessage },
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
        } else if (selectedGroupId) {
          response = await axios.post(
            `http://localhost:5000/api/groups/${selectedGroupId}/messages`,
            { senderId: userId, message: inputMessage },
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
        }
  
        console.log('API Response:', response.data); // Log the API response
  
        if (response && response.data) {
          const sentMessage = {
            id: response.data.id,
            sender_id: userId,
            sender_name: response.data.sender_name, // Use sender_name from the response
            receiver_id: selectedUserId || null,
            group_id: selectedGroupId || null,
            message: inputMessage,
            created_at: response.data.created_at || new Date().toISOString(),
          };
  
          console.log('Sent message data:', sentMessage); // Log sent message data
          setMessages((prevMessages) => [...prevMessages, sentMessage]);
  
          // Emit the appropriate event based on the message type
          if (selectedUserId) {
            console.log("normal"+selectedUserId);
            socket.emit('newMessage', sentMessage);  // Emit message to socket
          } else if (selectedGroupId) {
            console.log("group"+selectedGroupId);
            socket.emit('newGroupMessage', sentMessage); // Emit group message to socket
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    } else {
      console.log('Message input is empty or no user/group selected'); // Debugging empty input cases
    }
  };
  
  

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent the default Enter key behavior
      handleSendMessage();
    }
  };

  const renderMessages = () => {
    let lastDate = null;

    return messages.map((message) => {
      const messageDate = moment(message.created_at).format('YYYY-MM-DD');
      const isNewDate = messageDate !== lastDate;
      lastDate = messageDate;

      return (
        <React.Fragment key={message.id}>
          {isNewDate && (
            <div key={`date-${messageDate}`} className="w-full flex justify-center my-4">
              <div className="px-4 py-2 bg-gray-200 rounded">
                {moment(messageDate).format('MMMM D, YYYY')}
              </div>
            </div>
          )}
          <div className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'} mb-2`}>
            <div className={`max-w-xs p-2 rounded ${message.sender_id === userId ? 'bg-blue-600 text-white' : 'bg-gray-300 text-black'}`}>
              <div className="text-sm">
                {message.message}
              </div>
              <div className="text-xs text-right">
                {moment(message.created_at).format('h:mm A')}
              </div>
            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow p-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div>Loading...</div>
          </div>
        ) : (
          renderMessages()
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 border-t border-gray-300">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage} className="mt-2 w-full bg-blue-600 text-white py-2 rounded">
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;

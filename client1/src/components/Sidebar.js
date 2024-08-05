import React, { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const Sidebar = ({ onSelectUser, onSelectGroup }) => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  useEffect(() => {
    const fetchUsersAndGroups = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          return;
        }

        const userResponse = await axios.get('http://localhost:5000/api/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setCurrentUser(userResponse.data);

        const usersResponse = await axios.get('http://localhost:5000/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setUsers(usersResponse.data);

        const groupsResponse = await axios.get('http://localhost:5000/api/groups', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setGroups(groupsResponse.data);

      } catch (error) {
        console.error('Error fetching users or groups:', error.response ? error.response.data : error.message);
      }
    };

    fetchUsersAndGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      const fetchGroupMembers = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('No token found');
            return;
          }

          const groupMembersResponse = await axios.get(`http://localhost:5000/api/groups/${selectedGroupId}/members`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          setGroupMembers(groupMembersResponse.data);
        } catch (error) {
          console.error('Error fetching group members:', error.response ? error.response.data : error.message);
        }
      };

      fetchGroupMembers();
    }
  }, [selectedGroupId]);

  useEffect(() => {
    socket.on('newMessage', (message) => {
      console.log('New message received:', message);

      const messageTime = message.created_at || new Date().toISOString();

      if (message.group_id) {
        console.log('Updating group for group_id:', message.group_id);
        setGroups((prevGroups) => {
          const updatedGroups = prevGroups.map((group) => {
            if (group.id === message.group_id) {
              return { 
                ...group, 
                mostRecentMessageTime: messageTime,
                // Add or update other fields if needed
              };
            }
            return group;
          });
          console.log('Updated groups:', updatedGroups);
          return updatedGroups;
        });
      } else if (message.sender_id) {
        console.log('Updating user for sender_id:', message.sender_id);
        setUsers((prevUsers) => {
          const updatedUsers = prevUsers.map((user) => {
            if (user.id === message.sender_id) {
              return {
                ...user,
                mostRecentMessageTime: messageTime,
                unreadMessagesCount: (user.unreadMessagesCount || 0) + 1,
              };
            }
            return user;
          });
          console.log('Updated users:', updatedUsers);
          return updatedUsers;
        });
      }
    });

    return () => {
      socket.off('newMessage');
    };
  }, []);

  const filteredUsers = users
    .filter(user => user.username.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const recentMessageA = a.mostRecentMessageTime ? new Date(a.mostRecentMessageTime).getTime() : 0;
      const recentMessageB = b.mostRecentMessageTime ? new Date(b.mostRecentMessageTime).getTime() : 0;
      return recentMessageB - recentMessageA;
    });

  const filteredGroups = groups
    .filter(group => group.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const recentMessageA = a.mostRecentMessageTime ? new Date(a.mostRecentMessageTime).getTime() : 0;
      const recentMessageB = b.mostRecentMessageTime ? new Date(b.mostRecentMessageTime).getTime() : 0;
      return recentMessageB - recentMessageA;
    });

  const handleSelectUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      const userResponse = await axios.get('http://localhost:5000/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setCurrentUser(userResponse.data);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }

    onSelectUser(userId);
  };

  const handleSelectGroup = async (groupId) => {
    setSelectedGroupId(groupId);
    onSelectGroup(groupId);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      const groupMessagesResponse = await axios.get(`http://localhost:5000/api/groups/${groupId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const groupMessages = groupMessagesResponse.data;

      setGroups((prevGroups) => {
        const updatedGroups = prevGroups.map((group) => {
          if (group.id === groupId) {
            return { 
              ...group, 
              messages: groupMessages,
              mostRecentMessageTime: groupMessages.length > 0 
                ? new Date(groupMessages[groupMessages.length - 1].created_at).toISOString() 
                : null,
              // Add or update other fields if needed
            };
          }
          return group;
        });
        return updatedGroups;
      });

    } catch (error) {
      console.error('Error fetching group messages:', error.response ? error.response.data : error.message);
    }
  };

  return (
    <div className="w-64 h-full bg-gray-800 text-white overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Users and Groups</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
          placeholder="Search users or groups..."
        />
        <h3 className="text-lg font-semibold mb-2">Users</h3>
        <ul>
          {filteredUsers.map((user) => (
            <li
              key={user.id}
              className="flex items-center mb-4 p-2 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer"
              onClick={() => handleSelectUser(user.id)}
            >
              {user.image ? (
                <img
                  src={`http://localhost:5000/uploads/${user.image}`}
                  alt={user.username}
                  className="w-12 h-12 rounded-full mr-4"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white mr-4">U</div>
              )}
              <div className="flex flex-col">
                <span>{user.username}</span>
                {user.unreadMessagesCount > 0 && (
                  <span className="text-gray-400 text-sm">
                    Unread Messages: {user.unreadMessagesCount}
                  </span>
                )}
              </div>
              {user.unreadMessagesCount > 0 && (
                <span className="ml-auto bg-red-600 text-white px-2 py-1 rounded-full text-sm">
                  {user.unreadMessagesCount}
                </span>
              )}
            </li>
          ))}
        </ul>
        <h3 className="text-lg font-semibold mb-2">Groups</h3>
        <ul>
          {filteredGroups.map((group) => (
            <li
              key={group.id}
              className="flex items-center mb-4 p-2 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer"
              onClick={() => handleSelectGroup(group.id)}
            >
              <div className="flex flex-col">
                <span>{group.name}</span>
                <ul className="pl-4">
                  {groupMembers
                    .filter(member => member.group_id === group.id)
                    .map(member => (
                      <li key={member.id}>{member.username}</li>
                    ))}
                </ul>
                <div>
                  {group.messages && group.messages.map(message => (
                    <div key={message.id} className="text-sm">
                      {message.content}
                    </div>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;

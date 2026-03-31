import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, doc, updateDoc, Timestamp, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Send, User as UserIcon, Search, ArrowLeft, Loader2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: any;
  participantNames?: { [key: string]: string };
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export const Chats: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const path = 'chats';
    const q = query(
      collection(db, path),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatList);
      setLoading(false);

      // Select chat from state if provided
      const stateChatId = (location.state as any)?.chatId;
      if (stateChatId) {
        const foundChat = chatList.find(c => c.id === stateChatId);
        if (foundChat) {
          setActiveChat(foundChat);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, location.state]);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const path = `chats/${activeChat.id}/messages`;
    const q = query(
      collection(db, path),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgList);
      scrollToBottom();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [activeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChat || !newMessage.trim() || sending) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    const chatPath = `chats/${activeChat.id}`;
    const msgPath = `${chatPath}/messages`;

    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, msgPath), {
        senderId: user.uid,
        text,
        createdAt: now
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: text,
        updatedAt: now
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, msgPath);
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipantName = (chat: Chat) => {
    if (!user || !chat.participantNames) return 'Unknown User';
    const otherId = chat.participants.find(id => id !== user.uid);
    return otherId ? chat.participantNames[otherId] || 'Unknown User' : 'Unknown User';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-64px)]">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden h-full flex">
        
        {/* Chat List */}
        <div className={cn(
          "w-full md:w-80 border-r border-neutral-200 dark:border-neutral-800 flex flex-col",
          activeChat ? "hidden md:flex" : "flex"
        )}>
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-gold" />
              Messages
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.length > 0 ? (
              chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={cn(
                    "w-full p-4 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all border-b border-neutral-100 dark:border-neutral-800/50",
                    activeChat?.id === chat.id && "bg-gold/10 dark:bg-gold/5"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-gold/10 dark:bg-gold/5 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-gold dark:text-gold" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-bold text-neutral-900 dark:text-white truncate">
                      {getOtherParticipantName(chat)}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                      {chat.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-500">
                No conversations yet.
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className={cn(
          "flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950",
          !activeChat ? "hidden md:flex" : "flex"
        )}>
          {activeChat ? (
            <>
              {/* Header */}
              <div className="p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4">
                <button 
                  onClick={() => setActiveChat(null)}
                  className="md:hidden p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gold/10 dark:bg-gold/5 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-gold dark:text-gold" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white">
                    {getOtherParticipantName(activeChat)}
                  </h3>
                  <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex",
                        isMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[80%] p-4 rounded-2xl shadow-sm",
                        isMe 
                          ? "bg-navy text-white rounded-tr-none border border-gold/20" 
                          : "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-tl-none border border-neutral-200 dark:border-neutral-800"
                      )}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <p className={cn(
                          "text-[10px] mt-1 opacity-60",
                          isMe ? "text-right" : "text-left"
                        )}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-6 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-gold dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="p-4 bg-navy text-gold rounded-2xl hover:bg-navy/90 transition-all disabled:opacity-50 shadow-lg shadow-gold/10 dark:shadow-none border border-gold/20"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 p-8 text-center">
              <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-6">
                <MessageCircle className="w-10 h-10 text-neutral-300" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Your Conversations</h3>
              <p className="max-w-xs">Select a chat from the sidebar to start messaging with property agents.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

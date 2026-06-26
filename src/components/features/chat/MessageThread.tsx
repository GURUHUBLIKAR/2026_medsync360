import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';
import { useMessages, useSendMessage, useMarkAsRead } from '../../../hooks/useChat';
import { encrypt, decrypt } from '../../../lib/encryption';
import { cn } from '../../../lib/utils';
import { VoiceInput } from '../../ui/VoiceInput';
import type { Conversation, Message } from '../../../types/chat.types';
import { supabase } from '../../../lib/supabase';

// Hoisted helpers so they can be referenced before their definition
function resolveFirstPathSync(encryptedContent: string, isEncrypted: boolean): string | null {
  try {
    console.log('🔍 Resolving file path from content:', { isEncrypted, contentLength: encryptedContent.length });
    
    // lazy import to avoid cycle; decrypt is only needed inside Signed components
    const { decrypt } = require('../../../lib/encryption');
    let raw = encryptedContent;
    
    if (isEncrypted) {
      raw = decrypt(encryptedContent);
      console.log('🔓 Decrypted content:', raw);
    }
    
    // Try to parse as JSON array (for file paths)
    try {
      const arr = JSON.parse(raw) as string[];
      if (Array.isArray(arr) && arr.length > 0) {
        console.log('✅ Found file path in JSON array:', arr[0]);
        return arr[0];
      }
    } catch (jsonError) {
      console.log('⚠️ Content is not JSON array, checking if it\'s a direct path');
    }
    
    // If not JSON array, check if it's a direct file path
    if (raw.includes('/') && (raw.includes('.jpg') || raw.includes('.png') || raw.includes('.pdf') || raw.includes('.doc'))) {
      console.log('✅ Found direct file path:', raw);
      return raw;
    }
    
    console.log('❌ No valid file path found in content');
    return null;
  } catch (error) {
    console.error('❌ Error resolving file path:', error);
    return null;
  }
}

export function SignedImage({ encryptedContent, isEncrypted }: { encryptedContent: string; isEncrypted: boolean }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  
  useEffect(() => {
    console.log('🖼️ SignedImage: Processing image content');
    const path = resolveFirstPathSync(encryptedContent, isEncrypted);
    
    if (!path) {
      console.log('❌ SignedImage: No path resolved');
      setError('No file path found');
      return;
    }
    
    console.log('🔗 SignedImage: Creating signed URL for path:', path);
    supabase.storage
      .from('chat_attachments')
      .createSignedUrl(path, 60 * 15)
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ SignedImage: Error creating signed URL:', error);
          setError(error.message);
          setUrl(null);
        } else {
          console.log('✅ SignedImage: Signed URL created:', data?.signedUrl);
          setUrl(data?.signedUrl || null);
          setError(null);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encryptedContent, isEncrypted]);
  
  if (error) {
    return (
      <div className="w-40 h-32 bg-red-50 border border-red-200 rounded flex items-center justify-center">
                 <div className="text-center">
           <FileText className="w-8 h-8 text-red-400 mx-auto mb-1" />
           <p className="text-xs text-red-600">Error loading image</p>
         </div>
      </div>
    );
  }
  
  if (!url) {
    return (
      <div className="w-40 h-32 bg-gray-100 animate-pulse rounded flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="rounded overflow-hidden">
      <img 
        src={url} 
        alt="Image" 
        className="max-w-full h-auto"
        onError={() => {
          console.error('❌ SignedImage: Image failed to load');
          setError('Image failed to load');
        }}
      />
    </div>
  );
}

export function SignedAttachmentLink({ encryptedContent, isEncrypted }: { encryptedContent: string; isEncrypted: boolean }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  
  useEffect(() => {
    console.log('📎 SignedAttachmentLink: Processing file content');
    const path = resolveFirstPathSync(encryptedContent, isEncrypted);
    
    if (!path) {
      console.log('❌ SignedAttachmentLink: No path resolved');
      setError('No file path found');
      return;
    }
    
    console.log('🔗 SignedAttachmentLink: Creating signed URL for path:', path);
    supabase.storage
      .from('chat_attachments')
      .createSignedUrl(path, 60 * 15)
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ SignedAttachmentLink: Error creating signed URL:', error);
          setError(error.message);
          setUrl(null);
        } else {
          console.log('✅ SignedAttachmentLink: Signed URL created');
          setUrl(data?.signedUrl || null);
          setError(null);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encryptedContent, isEncrypted]);
  
  if (error) {
    return (
      <span className="text-sm text-red-600">
        Error: {error}
      </span>
    );
  }
  
  if (!url) {
    return (
      <span className="text-sm text-gray-500 flex items-center">
        <div className="w-3 h-3 mr-1 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        Resolving...
      </span>
    );
  }
  
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-800 underline">
      Download attachment
    </a>
  );
}

interface MessageThreadProps {
  conversation: Conversation;
  onBack?: () => void;
}

export const MessageThread: React.FC<MessageThreadProps> = ({ conversation, onBack }) => {
  console.log('🔍 MessageThread: Rendering with conversation:', conversation);
  
  try {
  
  const { ArrowLeft, Send, Paperclip, Smile, MoreVertical, Check, CheckCheck,
          Shield, Clock, Image, FileText, X, Mic, Zap, Sparkles, MessageSquare,
          Copy: CopyIcon, Quote, Trash2 } = LucideIcons;
  const { profile } = useAuthStore();
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: messages = [], isLoading } = useMessages(conversation.id);
  const sendMessageMutation = useSendMessage();
  const markAsReadMutation = useMarkAsRead();

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (conversation.id && conversation.unreadCount > 0) {
      markAsReadMutation.mutate({ conversationId: conversation.id });
    }
  }, [conversation.id, conversation.unreadCount, markAsReadMutation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  useEffect(() => {
    let typingTimeout: NodeJS.Timeout;
    
    if (messageText) {
      setIsTyping(true);
      // TODO: Send typing indicator to other user
      
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        // TODO: Send stopped typing indicator
      }, 2000);
    } else {
      setIsTyping(false);
      // TODO: Send stopped typing indicator
    }
    
    return () => {
      clearTimeout(typingTimeout);
    };
  }, [messageText]);

  const [isSending, setIsSending] = useState(false);
  
  const handleSendMessage = async () => {
    if ((!messageText.trim() && attachments.length === 0) || !profile?.id) return;
    
    setIsSending(true);
    
    try {
      // Show appropriate loading message
      const loadingMessage = attachments.length > 0 
        ? `Uploading ${attachments.length} file(s) and sending message...` 
        : 'Sending message...';
      toast.loading(loadingMessage, { id: 'send-message' });
      
      // Optionally prefix with a simple reply marker for UI context
      const prefix = replyTo ? `↩︎ ${replyTo.sender_id === profile.id ? 'You' : (conversation.otherParticipant?.full_name || 'User')}: ` +
        `${replyTo.is_encrypted ? (()=>{try{return decrypt(replyTo.content).slice(0,80);}catch{return '[Encrypted]';}})(): replyTo.content.slice(0,80)}\n\n` : '';
      const encryptedContent = encrypt(prefix + messageText);
      
      // Prepare message data
      const messageData = {
        conversationId: conversation.id,
        senderId: profile.id,
        content: encryptedContent,
        isEncrypted: true,
        messageType: attachments.length > 0 ? (attachments[0].type.startsWith('image/') ? 'image' : 'file') : 'text' as 'text' | 'file' | 'image' | 'voice',
        files: attachments
      };
      
      console.log('📤 Sending message with data:', {
        conversationId: messageData.conversationId,
        hasFiles: attachments.length > 0,
        fileCount: attachments.length,
        fileNames: attachments.map(f => f.name)
      });
      
      // Send message
      await sendMessageMutation.mutateAsync(messageData);
      
      // Success feedback
      const successMessage = attachments.length > 0 
        ? `Message with ${attachments.length} file(s) sent successfully!` 
        : 'Message sent successfully!';
      toast.success(successMessage, { id: 'send-message' });
      
      // Clear input
      setMessageText('');
      setAttachments([]);
      setReplyTo(null);
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      
      // More detailed error message
      let errorMessage = 'Failed to send message. Please try again.';
      if (error.message) {
        if (error.message.includes('storage')) {
          errorMessage = 'File upload failed. Please check your connection and try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check your authentication.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, { id: 'send-message' });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Validate file size and type
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-zip-compressed'
    ];
    
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`File "${file.name}" is too large. Maximum size is 5MB.`);
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type "${file.type}" is not supported.`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
      toast.success(`${validFiles.length} file(s) added successfully.`);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return '';
    }
  };

  const getMessageStatusIcon = (message: Message) => {
    if (message.sender_id !== profile?.id) return null;
    
    if (message.read_at) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    } else if (message.delivered_at) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    } else {
      return <Check className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / oneDay);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString();
  };

  // Validate conversation data
  if (!conversation || !conversation.id) {
    console.error('❌ MessageThread: Invalid conversation data:', conversation);
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 mr-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-10 h-10 bg-gray-300 rounded-full mr-3">
            {conversation.otherParticipant?.avatar_url && (
              <img
                src={conversation.otherParticipant.avatar_url}
                alt={conversation.otherParticipant.full_name}
                className="w-full h-full rounded-full object-cover"
              />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {conversation.otherParticipant?.full_name || 'Unknown User'}
            </h3>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-500 hover:text-gray-700">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">No messages yet</h3>
              <p className="text-sm text-gray-500">Send a message to start the conversation.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message: Message, index) => {
              const isCurrentUser = message.sender_id === profile?.id;
              
              // Decrypt message content
              let content = message.content;
              if (message.is_encrypted) {
                try {
                  content = decrypt(message.content);
                } catch (error) {
                  console.error('Failed to decrypt message:', error);
                  content = '[Encrypted message]';
                }
              }
              
              return (
                <div key={message.id} className={cn("flex", isCurrentUser ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "rounded-lg px-3 py-2 max-w-md",
                    isCurrentUser ? "bg-green-100 text-gray-900" : "bg-white text-gray-900"
                  )}>
                    <p className="text-sm">{content}</p>
                    <div className="flex items-center justify-end mt-1">
                      <span className="text-xs text-gray-400 mr-1">{formatMessageTime(message.created_at as string)}</span>
                      {getMessageStatusIcon(message as Message)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Attachments Preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-50 border-t border-gray-200 p-2 overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
                                {attachments.map((file, index) => (
                <div key={index} className="relative bg-white border-2 border-blue-200 rounded-lg p-3 flex items-center shadow-sm">
                  {file.type.startsWith('image/') ? (
                    <Image className="w-5 h-5 mr-3 text-blue-600" />
                  ) : (
                    <FileText className="w-5 h-5 mr-3 text-blue-600" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                    <div className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-3 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-600 font-medium">
              📎 {attachments.length} file(s) attached • {isSending ? 'Uploading...' : 'Ready to send'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-500 hover:text-gray-700">
            <Smile className="w-5 h-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="flex-1 relative">
            <VoiceInput
              value={messageText}
              onValueChange={(value) => setMessageText(value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message here.."
              className="w-full border border-gray-300 rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={(!messageText.trim() && attachments.length === 0) || isSending}
            className={cn(
              "p-2 rounded-full flex items-center justify-center transition-colors",
              (!messageText.trim() && attachments.length === 0) || isSending
                ? "bg-gray-200 text-gray-500"
                : "bg-blue-500 text-white hover:bg-blue-600"
            )}
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
  
  } catch (error) {
    console.error('❌ MessageThread: Unexpected error:', error);
    throw error; // Re-throw to trigger error boundary
  }
};

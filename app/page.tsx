'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Send, Plus, MessageCircle } from 'lucide-react'

// Chat Assistant Agent ID - Created via CLI
const CHAT_AGENT_ID = '692ebe0f6b01be7c2f9f44d4'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface Conversation {
  id: string
  messages: Message[]
  createdAt: string
}

export default function HomePage() {
  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])

  // Input and loading state
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0 && showWelcome) {
      const welcomeMessage: Message = {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content:
          'Hello! I\'m your Chat Assistant. How can I help you today? Feel free to ask me anything!',
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }
      setMessages([welcomeMessage])
    }
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timer)
  }, [messages])

  // Create new conversation
  const createNewChat = () => {
    const newConversationId = 'conv-' + Date.now()
    const newConversation: Conversation = {
      id: newConversationId,
      messages: [
        {
          id: 'welcome-' + Date.now(),
          role: 'assistant',
          content:
            'Hello! I\'m your Chat Assistant. How can I help you today? Feel free to ask me anything!',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      ],
      createdAt: new Date().toISOString()
    }

    setConversations([newConversation, ...conversations])
    setCurrentConversationId(newConversationId)
    setMessages(newConversation.messages)
    setShowWelcome(true)
  }

  // Load conversation
  const loadConversation = (conversationId: string) => {
    const conversation = conversations.find((c) => c.id === conversationId)
    if (conversation) {
      setCurrentConversationId(conversationId)
      setMessages(conversation.messages)
      setShowWelcome(false)
    }
  }

  // Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return

    // Clear welcome message on first user message
    if (showWelcome && messages.length === 1) {
      setMessages([])
      setShowWelcome(false)
    }

    // Create user message
    const userMessage: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      // Call Chat Agent API
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          agent_id: CHAT_AGENT_ID,
          session_id: currentConversationId || 'new-session'
        })
      })

      const data = await response.json()

      if (data.success && data.response) {
        // Extract response text with multiple fallbacks
        const responseText = data.response?.result
          ?? data.response?.response
          ?? (typeof data.response === 'string' ? data.response : null)
          ?? 'I apologize, but I was unable to process that request. Please try again.'

        const assistantMessage: Message = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        }

        const finalMessages = [...updatedMessages, assistantMessage]
        setMessages(finalMessages)

        // Update conversation in state
        if (currentConversationId) {
          setConversations((prevConversations) =>
            prevConversations.map((conv) =>
              conv.id === currentConversationId
                ? { ...conv, messages: finalMessages }
                : conv
            )
          )
        } else {
          // Create new conversation if needed
          const newConvId = 'conv-' + Date.now()
          const newConversation: Conversation = {
            id: newConvId,
            messages: finalMessages,
            createdAt: new Date().toISOString()
          }
          setConversations([newConversation, ...conversations])
          setCurrentConversationId(newConvId)
        }
      } else {
        // Handle error response
        const errorMessage: Message = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
        setMessages([...updatedMessages, errorMessage])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: 'Connection error. Please check your internet and try again.',
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }
      setMessages([...updatedMessages, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Conversation History */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <Button
            onClick={createNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const firstMessage = conv.messages[1]?.content || 'New conversation'
              const preview = firstMessage.substring(0, 40) + (firstMessage.length > 40 ? '...' : '')

              return (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                    currentConversationId === conv.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="truncate font-medium">{preview}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Chat Assistant</h1>
        </div>

        {/* Messages Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {messages.length === 0 && !showWelcome && (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-400">Start a conversation</p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-900 rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                <div
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-900 px-4 py-3 rounded-lg rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white px-6 py-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1 text-gray-900 placeholder-gray-500"
              maxLength={500}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <div className="text-xs text-gray-400 mt-2">
            {input.length}/500 characters
          </div>
        </div>
      </div>
    </div>
  )
}

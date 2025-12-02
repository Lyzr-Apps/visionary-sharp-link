'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ChevronDown, Copy, Send, Plus, MessageCircle, Search } from 'lucide-react'

// Knowledge Base Chat Agent ID
const KB_AGENT_ID = '692f5c096faee4d469e81a63'

interface Source {
  document_name: string
  excerpt: string
  relevance_score: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  answer?: string
  sources?: Source[]
  suggested_followups?: string[]
  timestamp: string
  confidence?: number
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
}

interface AgentResponse {
  success: boolean
  response?: {
    result?: {
      answer: string
      sources: Source[]
      suggested_followups: string[]
    }
    answer?: string
    sources?: Source[]
    suggested_followups?: string[]
  } | string
  raw_response?: string
  agent_id?: string
}

const SAMPLE_SUGGESTED_QUESTIONS = [
  'What is our refund policy?',
  'How do I reset my password?',
  'What are the system requirements?',
  'Tell me about pricing options',
]

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Initialize welcome state
  useEffect(() => {
    if (messages.length === 0 && showWelcome) {
      setMessages([])
    }
  }, [])

  // Auto-scroll
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timer)
  }, [messages])

  // Format timestamp for client-side rendering
  const getFormattedTime = () => {
    if (typeof window === 'undefined') return '00:00'
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Create new conversation
  const createNewChat = () => {
    const newConversationId = 'conv-' + Date.now()
    const newConversation: Conversation = {
      id: newConversationId,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString()
    }

    setConversations([newConversation, ...conversations])
    setCurrentConversationId(newConversationId)
    setMessages([])
    setShowWelcome(true)
    setInput('')
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

  // Filter conversations
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Copy to clipboard
  const copyToClipboard = (text: string, messageId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return

    if (showWelcome && messages.length === 0) {
      setShowWelcome(false)
    }

    const userMessage: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: input,
      timestamp: getFormattedTime()
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    const userQuery = input
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userQuery,
          agent_id: KB_AGENT_ID,
          session_id: currentConversationId || 'new-session'
        })
      })

      const data: AgentResponse = await response.json()

      if (data.success && data.response) {
        let answerText = ''
        let sources: Source[] = []
        let suggestedFollowups: string[] = []
        let confidence = 0.92

        // Parse response with multiple fallback strategies
        if (typeof data.response === 'object' && data.response !== null) {
          const resp = data.response as any
          if (resp.result) {
            answerText = resp.result.answer ?? ''
            sources = Array.isArray(resp.result.sources) ? resp.result.sources : []
            suggestedFollowups = Array.isArray(resp.result.suggested_followups)
              ? resp.result.suggested_followups
              : []
          } else if (resp.answer) {
            answerText = resp.answer
            sources = Array.isArray(resp.sources) ? resp.sources : []
            suggestedFollowups = Array.isArray(resp.suggested_followups)
              ? resp.suggested_followups
              : []
          }
        } else if (typeof data.response === 'string') {
          answerText = data.response
        }

        // Fallback message
        if (!answerText) {
          answerText =
            'I found relevant information in the knowledge base, but I could not generate a complete answer. Please try rephrasing your question.'
        }

        const assistantMessage: Message = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: answerText,
          answer: answerText,
          sources: sources,
          suggested_followups: suggestedFollowups,
          timestamp: getFormattedTime(),
          confidence: confidence
        }

        const finalMessages = [...updatedMessages, assistantMessage]
        setMessages(finalMessages)

        // Update or create conversation
        if (currentConversationId) {
          setConversations((prevConversations) =>
            prevConversations.map((conv) =>
              conv.id === currentConversationId
                ? {
                    ...conv,
                    messages: finalMessages,
                    title:
                      conv.messages.length === 0
                        ? userQuery.substring(0, 50)
                        : conv.title
                  }
                : conv
            )
          )
        } else {
          const newConvId = 'conv-' + Date.now()
          const newConversation: Conversation = {
            id: newConvId,
            title: userQuery.substring(0, 50),
            messages: finalMessages,
            createdAt: new Date().toISOString()
          }
          setConversations([newConversation, ...conversations])
          setCurrentConversationId(newConvId)
        }
      } else {
        const errorMessage: Message = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content:
            'I encountered an error processing your question. Please try again or rephrase your question.',
          timestamp: getFormattedTime()
        }
        setMessages([...updatedMessages, errorMessage])
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: 'Connection error. Please check your internet connection and try again.',
        timestamp: getFormattedTime()
      }
      setMessages([...updatedMessages, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Suggest follow-up question
  const handleSuggestedQuestion = async (question: string) => {
    setInput(question)
    // Auto-submit after a brief delay for UX
    setTimeout(() => {
      const form = document.querySelector('form')
      if (form) {
        const event = new Event('submit', { bubbles: true })
        form.dispatchEvent(event)
      }
    }, 100)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200">
          <Button
            onClick={createNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-sm text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>{searchQuery ? 'No conversations found' : 'No conversations yet'}</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="truncate font-medium">{conv.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Base Chatbot</h1>
            <p className="text-sm text-gray-500 mt-1">Ask questions about our documentation</p>
          </div>
        </div>

        {/* Messages Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-6"
        >
          {messages.length === 0 && showWelcome && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <MessageCircle className="w-16 h-16 mx-auto text-blue-300 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome</h2>
                <p className="text-gray-600 mb-6">
                  Ask me anything about our knowledge base. I will search through our documentation and
                  provide answers with source references.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {SAMPLE_SUGGESTED_QUESTIONS.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm text-left transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-2xl">
                {/* Message Bubble */}
                <div
                  className={`px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                  <div
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp}
                  </div>
                </div>

                {/* Source References */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-semibold text-gray-600 px-1">Sources</div>
                    {message.sources.map((source, idx) => {
                      const sourceId = `${message.id}-source-${idx}`
                      const isExpanded = expandedSourceId === sourceId

                      return (
                        <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                          <button
                            onClick={() =>
                              setExpandedSourceId(isExpanded ? null : sourceId)
                            }
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
                          >
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-gray-900">{source.document_name}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Relevance: {(source.relevance_score * 100).toFixed(0)}%
                              </div>
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 transition-transform ${
                                isExpanded ? 'transform rotate-180' : ''
                              }`}
                            />
                          </button>

                          {isExpanded && (
                            <div className="px-3 py-2 bg-white border-t border-gray-200 text-xs text-gray-700 max-h-40 overflow-y-auto">
                              <p className="leading-relaxed">{source.excerpt}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Copy Button */}
                {message.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="mt-2 flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedId === message.id ? 'Copied!' : 'Copy'}
                  </button>
                )}

                {/* Suggested Follow-ups */}
                {message.suggested_followups && message.suggested_followups.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-gray-600 px-1 mb-2">Related questions</div>
                    <div className="space-y-2">
                      {message.suggested_followups.map((followup, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestedQuestion(followup)}
                          className="w-full p-2 text-left text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                        >
                          {followup}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
              placeholder="Ask a question..."
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
          <div className="text-xs text-gray-400 mt-2">{input.length}/500 characters</div>
        </div>
      </div>
    </div>
  )
}

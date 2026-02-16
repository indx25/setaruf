'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Send, MoreVertical, Check, CheckCheck } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string
  isRead: boolean
  createdAt: string
}

interface User {
  id: string
  name: string
  avatar?: string
  profile?: {
    initials?: string
    age?: number
    occupation?: string
  }
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.matchId as string

  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [otherUser, setOtherUser] = useState<User | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Get user ID from cookie
  useEffect(() => {
    const getUserId = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()
        if (response.ok) {
          setCurrentUserId(data.user.id)
        }
      } catch (err) {
        console.error('Error getting user:', err)
      }
    }
    getUserId()
  }, [])

  // Load match data
  useEffect(() => {
    const loadMatchData = async () => {
      try {
        const response = await fetch(`/api/matches/${matchId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat data match')
        }

        setOtherUser(data.otherUser)
        setIsLoading(false)
      } catch (err: any) {
        setError(err.message)
        setIsLoading(false)
      }
    }

    loadMatchData()
  }, [matchId])

  // Connect to WebSocket
  useEffect(() => {
    if (!currentUserId) return

    const newSocket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('Connected to chat service')
      setIsConnected(true)
      // Join match room
      newSocket.emit('join_match', { userId: currentUserId, matchId })
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from chat service')
      setIsConnected(false)
    })

    newSocket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message)
      setError(data.message)
    })

    newSocket.on('chat_history', (data: { messages: Message[] }) => {
      setMessages(data.messages)
    })

    newSocket.on('new_message', (message: Message) => {
      setMessages(prev => [...prev, message])
    })

    newSocket.on('message_read', (data: { messageId: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId ? { ...msg, isRead: true } : msg
        )
      )
    })

    newSocket.on('message_read_ack', (data: { messageId: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId ? { ...msg, isRead: true } : msg
        )
      )
    })

    newSocket.on('user_typing', (data: { userId: string; isTyping: boolean }) => {
      if (data.userId !== currentUserId) {
        setOtherUserTyping(data.isTyping)
      }
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [currentUserId, matchId])

  // Send message
  const handleSendMessage = () => {
    if (!messageInput.trim() || !otherUser || !socket) return

    socket.emit('send_message', {
      senderId: currentUserId,
      receiverId: otherUser.id,
      matchId,
      content: messageInput.trim()
    })

    setMessageInput('')
    setIsTyping(false)
  }

  // Handle typing
  const handleTyping = (value: string) => {
    setMessageInput(value)
    const typing = value.trim().length > 0

    if (typing !== isTyping && socket) {
      setIsTyping(typing)
      socket.emit('typing', { userId: currentUserId, matchId, isTyping: typing })
    }
  }

  // Mark message as read
  const handleMarkAsRead = (messageId: string) => {
    if (socket) {
      socket.emit('mark_as_read', { messageId })
    }
  }

  // Get initials
  const getInitials = (name: string) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat chat...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!otherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>Data pasangan tidak ditemukan</AlertDescription>
        </Alert>
      </div>
    )
  }

  const otherUserInitials = otherUser.profile?.initials || getInitials(otherUser.name || '')

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <Avatar className="w-10 h-10">
          <AvatarImage src={otherUser.avatar || otherUser.profile?.photoUrl} />
          <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white">
            {otherUserInitials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <h2 className="font-semibold">{otherUserInitials}</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {otherUser.profile?.occupation && <span>{otherUser.profile.occupation}</span>}
            {isConnected && <span className="text-green-500">• Online</span>}
            {!isConnected && <span className="text-gray-400">• Offline</span>}
          </div>
        </div>

        <Button variant="ghost" size="icon">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p>Belum ada pesan. Mulai percakapan dengan {otherUserInitials}!</p>
            </div>
          )}

          {messages.map((message) => {
            const isOwnMessage = message.senderId === currentUserId
            const messageTime = format(new Date(message.createdAt), 'HH:mm', { locale: id })

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isOwnMessage && (
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={otherUser.avatar || otherUser.profile?.photoUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white text-xs">
                        {otherUserInitials}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div>
                    <Card
                      className={`${
                        isOwnMessage
                          ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white border-0'
                          : 'bg-white'
                      }`}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </CardContent>
                    </Card>

                    <div className={`flex items-center gap-1 mt-1 text-xs text-gray-500 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <span>{messageTime}</span>
                      {isOwnMessage && (
                        <>
                          {message.isRead ? (
                            <CheckCheck className="w-3 h-3 text-blue-500" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {otherUserTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[70%]">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white text-xs">
                    {otherUserInitials}
                  </AvatarFallback>
                </Avatar>
                <Card className="bg-gray-200">
                  <CardContent className="p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="bg-white border-t p-4 sticky bottom-0">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            placeholder="Ketik pesan..."
            value={messageInput}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={!isConnected}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isConnected}
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Tidak terhubung ke server. Pesan mungkin terlambat.
          </p>
        )}
      </div>
    </div>
  )
}

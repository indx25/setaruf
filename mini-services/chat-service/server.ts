import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Store online users: userId -> socketId
const onlineUsers = new Map<string, string>()

// Store user rooms: socketId -> Set of matchIds (room names)
const userRooms = new Map<string, Set<string>>()

// Store typing status: matchId -> Set of userIds who are typing
const typingUsers = new Map<string, Set<string>>()

interface SocketUser {
  userId: string
  name: string
}

interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  matchId: string
  content: string
  isRead: boolean
  createdAt: Date
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Authenticate and join room
  socket.on('authenticate', async (data: { userId: string; matchId: string }) => {
    const { userId, matchId } = data

    try {
      // TODO: In production, verify user is part of the match by calling main app API
      // For now, we'll trust the client and let the main app handle authorization

      // Store user info
      onlineUsers.set(userId, socket.id)

      // Store the room for this socket
      if (!userRooms.has(socket.id)) {
        userRooms.set(socket.id, new Set())
      }
      userRooms.get(socket.id)!.add(matchId)

      // Join the match room
      socket.join(matchId)

      console.log(`User ${userId} joined room ${matchId}`)

      // Notify other users in the room that this user is online
      socket.to(matchId).emit('user-online', {
        userId,
        socketId: socket.id,
      })
    } catch (error) {
      console.error('Error authenticating user:', error)
      socket.emit('error', { message: 'Authentication failed' })
    }
  })

  // Send message
  socket.on('send-message', async (data: {
    matchId: string
    senderId: string
    receiverId: string
    content: string
    senderName: string
  }) => {
    const { matchId, senderId, receiverId, content, senderName } = data

    try {
      // TODO: In production, save message to database via main app API
      // For now, we'll just broadcast the message

      const message: ChatMessage = {
        id: `${Date.now()}-${senderId}`,
        senderId,
        senderName,
        receiverId,
        matchId,
        content,
        isRead: false,
        createdAt: new Date(),
      }

      // Broadcast message to the room (both sender and receiver)
      io.to(matchId).emit('new-message', message)

      console.log(`Message sent in room ${matchId} from ${senderId} to ${receiverId}`)
    } catch (error) {
      console.error('Error sending message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // Mark message as read
  socket.on('mark-read', (data: { matchId: string; senderId: string }) => {
    const { matchId, senderId } = data

    try {
      // Notify sender that message was read
      socket.to(matchId).emit('message-read', {
        matchId,
        readerId: onlineUsers.get(socket.id),
        timestamp: new Date(),
      })

      console.log(`Messages in room ${matchId} marked as read`)
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  })

  // Typing indicator
  socket.on('typing', (data: { matchId: string; userId: string; userName: string }) => {
    const { matchId, userId, userName } = data

    try {
      // Add user to typing set for this room
      if (!typingUsers.has(matchId)) {
        typingUsers.set(matchId, new Set())
      }
      typingUsers.get(matchId)!.add(userId)

      // Notify other users in the room that someone is typing
      socket.to(matchId).emit('user-typing', {
        userId,
        userName,
        matchId,
      })
    } catch (error) {
      console.error('Error handling typing indicator:', error)
    }
  })

  // Stop typing indicator
  socket.on('stop-typing', (data: { matchId: string; userId: string }) => {
    const { matchId, userId } = data

    try {
      // Remove user from typing set
      if (typingUsers.has(matchId)) {
        typingUsers.get(matchId)!.delete(userId)
      }

      // Notify other users in the room
      socket.to(matchId).emit('user-stopped-typing', {
        userId,
        matchId,
      })
    } catch (error) {
      console.error('Error handling stop typing indicator:', error)
    }
  })

  // Leave room
  socket.on('leave-room', (data: { matchId: string }) => {
    const { matchId } = data

    try {
      // Remove room from user's rooms
      if (userRooms.has(socket.id)) {
        userRooms.get(socket.id)!.delete(matchId)
      }

      // Leave the socket.io room
      socket.leave(matchId)

      console.log(`User ${socket.id} left room ${matchId}`)
    } catch (error) {
      console.error('Error leaving room:', error)
    }
  })

  // Disconnect
  socket.on('disconnect', () => {
    try {
      // Find user by socket ID and remove from online users
      let disconnectedUserId: string | null = null
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId
          onlineUsers.delete(userId)
          break
        }
      }

      // Notify all rooms this user was in that they're offline
      if (disconnectedUserId && userRooms.has(socket.id)) {
        const rooms = userRooms.get(socket.id)!
        for (const matchId of rooms) {
          socket.to(matchId).emit('user-offline', {
            userId: disconnectedUserId,
          })
        }
        userRooms.delete(socket.id)
      }

      console.log(`User disconnected: ${socket.id}`)
    } catch (error) {
      console.error('Error handling disconnect:', error)
    }
  })

  // Error handling
  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Chat service running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down chat service...')
  httpServer.close(() => {
    console.log('Chat service closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down chat service...')
  httpServer.close(() => {
    console.log('Chat service closed')
    process.exit(0)
  })
})

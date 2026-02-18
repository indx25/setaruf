import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const io = new Server({
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// Store online users
const onlineUsers = new Map<string, string>() // socketId -> userId
const userSockets = new Map<string, string>() // userId -> socketId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // User joins a room (for a specific match)
  socket.on('join_match', async (data: { userId: string; matchId: string }) => {
    try {
      const { userId, matchId } = data

      // Verify match exists and user is part of it
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          OR: [
            { requesterId: userId },
            { targetId: userId }
          ],
          step: { in: ['chatting', 'full_data_approved'] }
        }
      })

      if (!match) {
        socket.emit('error', { message: 'Match tidak valid atau belum bisa chat' })
        return
      }

      // Join the match room
      socket.join(`match_${matchId}`)

      // Store user mapping
      onlineUsers.set(socket.id, userId)
      userSockets.set(userId, socket.id)

      // Notify other user in the match
      const otherUserId = match.requesterId === userId ? match.targetId : match.requesterId
      const otherSocketId = userSockets.get(otherUserId)

      if (otherSocketId) {
        io.to(otherSocketId).emit('user_joined_chat', { userId })
      }

      // Load recent messages
      const messages = await prisma.message.findMany({
        where: { matchId },
        orderBy: { createdAt: 'asc' },
        take: 50
      })

      socket.emit('chat_history', { messages })

      console.log(`User ${userId} joined match ${matchId}`)
    } catch (error) {
      console.error('Error joining match:', error)
      socket.emit('error', { message: 'Gagal bergabung ke chat' })
    }
  })

  // Send message
  socket.on('send_message', async (data: {
    senderId: string
    receiverId: string
    matchId: string
    content: string
  }) => {
    try {
      const { senderId, receiverId, matchId, content } = data

      // Verify match exists and user can chat
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          OR: [
            { requesterId: senderId },
            { targetId: senderId }
          ]
        }
      })

      if (!match) {
        socket.emit('error', { message: 'Match tidak valid' })
        return
      }

      // Create message in database
      const message = await prisma.message.create({
        data: {
          senderId,
          receiverId,
          matchId,
          content
        }
      })

      // Emit to both users in the match room
      io.to(`match_${matchId}`).emit('new_message', message)

      // Mark as read if receiver is online
      const receiverSocketId = userSockets.get(receiverId)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message_read', { messageId: message.id })
        // Update read status
        await prisma.message.update({
          where: { id: message.id },
          data: { isRead: true }
        })
      }

      console.log(`Message sent in match ${matchId} from ${senderId} to ${receiverId}`)
    } catch (error) {
      console.error('Error sending message:', error)
      socket.emit('error', { message: 'Gagal mengirim pesan' })
    }
  })

  // Typing indicator
  socket.on('typing', (data: { userId: string; matchId: string; isTyping: boolean }) => {
    const { userId, matchId, isTyping } = data
    socket.to(`match_${matchId}`).emit('user_typing', { userId, isTyping })
  })

  // Mark message as read
  socket.on('mark_as_read', async (data: { messageId: string }) => {
    try {
      await prisma.message.update({
        where: { id: data.messageId },
        data: { isRead: true }
      })
      socket.emit('message_read_ack', { messageId: data.messageId })
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  })

  // Disconnect
  socket.on('disconnect', () => {
    const userId = onlineUsers.get(socket.id)
    if (userId) {
      onlineUsers.delete(socket.id)
      userSockets.delete(userId)
      console.log(`User ${userId} disconnected`)
    }
  })
})

const PORT = 3003

io.listen(PORT, () => {
  console.log(`Chat service running on port ${PORT}`)
})

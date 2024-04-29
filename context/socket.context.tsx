'use client'
import React, { createContext, useEffect, useState } from 'react'
import { socket } from '../app/socket'

type ISocketContext = {
  isConnected: boolean
  transport: string
  socketId: string
  username: string
  users: [string, string][]
  setUsername: (username: string) => void
}

const SocketContext = createContext<ISocketContext>(null)

const SocketContextProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [transport, setTransport] = useState<string>()
  const [socketId, setSocketId] = useState<string>()
  const [username, setUsername] = useState<string>('anonymous')
  const [users, setUsers] = useState<[string, string][]>([])
  

  useEffect(() => {
    if (socket.connected) {
      onConnect()
    }

    function onConnect() {
      setIsConnected(true)
      setTransport(socket.io.engine.transport.name)
      setSocketId(socket.id)
      socket.io.engine.on('upgrade', (transport) => {
        setTransport(transport.name)
      })
    }

    function onDisconnect() {
      setIsConnected(false)
      setTransport('N/A')
    }

    function onUsersUpdate(users: [string, string][]) {
      setUsers(users)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.emit('get_users')
    socket.on('users', onUsersUpdate)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('users', onUsersUpdate)
    }
  }, [])
  return (
    <SocketContext.Provider
      value={{
        isConnected,
        transport,
        socketId,
        username,
        setUsername,
        users,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => React.useContext(SocketContext)

export default SocketContextProvider

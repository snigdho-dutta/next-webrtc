'use client'
type Props = {
  isConnected: boolean
  username: string
  setUsername: (username: string) => void
  socketId: string
  transport: string
}

const InfoCard = ({
  isConnected,
  username,
  setUsername,
  socketId,
  transport,
}: Props) => {
  return (
    <div className='border w-fit flex flex-col p-2 gap-[0.4] rounded-lg'>
      <p>Status: {isConnected ? 'connected' : 'disconnected'}</p>
      <p>Transport: {transport}</p>
      <p>Socket ID: {socketId}</p>
      <p>Username: {username}</p>
    </div>
  )
}

export default InfoCard
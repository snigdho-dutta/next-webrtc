import React from 'react'

interface Props extends React.PropsWithChildren {
  params: { id: string }
}

const ChatLayout = ({ children }: Props) => {
  return (
    <div className='h-screen w-screen p-2 gap-2 bg-slate-900'>{children}</div>
  )
}

export default ChatLayout

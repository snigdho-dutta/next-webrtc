import React from 'react'

interface Props extends React.PropsWithChildren {
  params: { id: string }
}

const ChatLayout = ({ children }: Props) => {
  return <div>{children}</div>
}

export default ChatLayout

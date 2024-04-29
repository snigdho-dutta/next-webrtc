interface User {
  id: string
  name: string
}

const Chatbox: React.FC<{ user: User }> = ({ user }) => {
  return (
    <div>
      Chat Box
      <div className=''>{user.name}</div>
      <div className=''>{user.id}</div>
      <div className="">
        <input type="text" />
      </div>
    </div>
  )
}

export default Chatbox

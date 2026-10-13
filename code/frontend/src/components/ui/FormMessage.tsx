export type Message = {
  text: string
  isError: boolean
}

function FormMessage({ message }: { message: Message | null }) {
  if (!message) {
    return null
  }
  return <p className={`text-sm ${message.isError ? 'text-red-700' : 'text-green-700'}`}>{message.text}</p>
}

export default FormMessage

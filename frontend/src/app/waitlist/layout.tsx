import { Toaster } from 'react-hot-toast'

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1C1C1C',
            color: '#fff',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '14px',
            maxWidth: '500px',
            outline: 'none',
          },
          success: {
            iconTheme: { primary: '#FFCC00', secondary: '#1C1C1C' },
            style: {
              background: '#1C1C1C',
              color: '#fff',
              border: '2px solid #FFCC00',
              outline: 'none',
            },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
            style: {
              background: '#1C1C1C',
              color: '#fff',
              border: '2px solid #EF4444',
              outline: 'none',
            },
            duration: 5000,
          },
        }}
      />
      {children}
    </>
  )
}

const year = new Date().getFullYear()

function Footer() {
  return (
    <footer className="bg-primary text-white">
      <div className="border-t border-white/15">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-white/70 sm:px-6 text-center">
          &copy; {year} WaaiTrack, gemaakt door Digital Innovation
        </p>
      </div>
    </footer>
  )
}

export default Footer

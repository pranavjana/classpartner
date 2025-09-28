export default function Footer() {
  return (
    <footer className="border-t border-gray-800">
      <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-gray-400 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>© {new Date().getFullYear()} ClassPartner</div>
        <div className="flex gap-4">
          <a href="/privacy" className="hover:text-gray-200">Privacy</a>
          <a href="/terms" className="hover:text-gray-200">Terms</a>
          <a href="/contact" className="hover:text-gray-200">Contact</a>
        </div>
      </div>
    </footer>
  );
}

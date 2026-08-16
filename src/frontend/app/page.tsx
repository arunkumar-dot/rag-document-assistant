import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Lumen</h1>
        <p className="mt-2 text-gray-600">
          Upload PDF documents and ask questions about their contents.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/upload"
          className="rounded-lg border border-gray-200 p-5 transition-colors hover:border-indigo-300"
        >
          <h2 className="font-medium text-gray-900">Upload</h2>
          <p className="mt-1 text-sm text-gray-500">Add a PDF to your document library.</p>
        </Link>
        <Link
          href="/query"
          className="rounded-lg border border-gray-200 p-5 transition-colors hover:border-indigo-300"
        >
          <h2 className="font-medium text-gray-900">Query</h2>
          <p className="mt-1 text-sm text-gray-500">Ask a question and get a streamed answer.</p>
        </Link>
      </div>
    </div>
  );
}

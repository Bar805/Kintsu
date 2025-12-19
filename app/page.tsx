import Link from 'next/link'

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            <h1 className="text-4xl font-bold mb-8">Trio</h1>
            <p className="mb-8 text-xl">The social connection app</p>

            <div className="flex gap-4">
                <Link
                    href="/login"
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition"
                >
                    Login
                </Link>
                <Link
                    href="/dashboard"
                    className="bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition"
                >
                    Go to Dashboard
                </Link>
            </div>
        </main>
    )
}

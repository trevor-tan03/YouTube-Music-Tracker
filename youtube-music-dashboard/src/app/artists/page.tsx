import { DashboardNav } from "@/src/app/components/DashboardNav";

async function getArtists() {
    const response = await fetch("http://localhost:3001/api/artists", {
        cache: "no-store",
    });
    return response.json();
}

export default async function Artists() {
    const artists = await getArtists();

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
            <DashboardNav />
            <h1 className="mb-6 text-3xl font-semibold">Artists</h1>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {artists.map((artist: { id: number; name: string }) => (
                    <div
                        key={artist.id}
                        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                        <h2 className="font-medium">{artist.name}</h2>
                    </div>
                ))}
            </div>
        </main>
    );
}

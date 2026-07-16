import { DashboardNav } from "@/src/app/components/DashboardNav";

async function getDashboardData() {
    const [artistsResponse, songsResponse] = await Promise.all([
        fetch("http://localhost:3001/api/artists", { cache: "no-store" }),
        fetch("http://localhost:3001/api/songs?limit=5", { cache: "no-store" }),
    ]);

    const artists = await artistsResponse.json();
    const songsData = await songsResponse.json();

    return { artists, songsData };
}

export default async function Home() {
    const { artists, songsData } = await getDashboardData();
    const songs = songsData.videos ?? [];

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
            <DashboardNav />
            <h1 className="mb-8 text-3xl font-semibold">
                YouTube Music Tracker
            </h1>
            <div className="grid gap-6 md:grid-cols-2">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-semibold">Top artists</h2>
                    <div className="space-y-3">
                        {artists
                            .slice(0, 5)
                            .map((artist: { id: number; name: string }) => (
                                <div
                                    key={artist.id}
                                    className="rounded-lg bg-zinc-50 px-4 py-3"
                                >
                                    {artist.name}
                                </div>
                            ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-semibold">Recent songs</h2>
                    <div className="space-y-3">
                        {songs.map((video: { id: string; title: string }) => (
                            <div
                                key={video.id}
                                className="rounded-lg bg-zinc-50 px-4 py-3"
                            >
                                {video.title}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}

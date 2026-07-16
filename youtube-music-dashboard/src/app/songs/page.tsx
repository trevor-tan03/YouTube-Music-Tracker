import { DashboardNav } from "@/src/app/components/DashboardNav";

async function getSongs() {
    const response = await fetch("http://localhost:3001/api/songs", {
        cache: "no-store",
    });
    return response.json();
}

export default async function Songs() {
    const data = await getSongs();
    const songs = data.videos ?? [];

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
            <DashboardNav />
            <h1 className="mb-6 text-3xl font-semibold">Songs</h1>
            <div className="grid gap-4">
                {songs.map(
                    (video: {
                        id: string;
                        title: string;
                        total_listening_time?: number;
                    }) => (
                        <div
                            key={video.id}
                            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <h2 className="font-medium">{video.title}</h2>
                                <span className="text-sm text-zinc-500">
                                    {Math.round(
                                        (video.total_listening_time ?? 0) / 60,
                                    )}{" "}
                                    mins
                                </span>
                            </div>
                        </div>
                    ),
                )}
            </div>
        </main>
    );
}

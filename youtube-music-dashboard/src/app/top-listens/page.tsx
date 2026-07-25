interface Video {
    id: string;
    title: string;
    total_listening_time: number;
}

async function getTopListens() {
    const res = await fetch("http://localhost:3001/api/top-listens");
    const body = (await res.json()) as Video[];
    return body;
}

export default async function TopListens() {
    const topListens = await getTopListens();

    return (
        <div>
            <h1>Top Listens</h1>
            {topListens.map((listen, i) => (
                <div key={`listen-${i}`}>
                    <p>
                        {listen.title} ({listen.total_listening_time})
                        {/* <Image
                            src={`https://i.ytimg.com/vi/${listen.id}/hqdefault.jpg`}
                            width={200}
                            alt="thumbnail"
                        /> */}
                    </p>
                </div>
            ))}
        </div>
    );
}

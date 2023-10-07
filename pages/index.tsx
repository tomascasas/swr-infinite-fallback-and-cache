import { Inter } from "next/font/google";
import {
  buildGetKey,
  getFirstPageKey,
  useInfiniteFetch,
} from "hooks/InfiniteFetch";
import { ActionResponse, Entity } from "pages/api/entities";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";

const inter = Inter({ subsets: ["latin"] });

const path = "/api/entities";
const body = {
  action: "getEntities",
  params: { limit: 20 },
};

const Home = ({
  firstPageData,
}: {
  firstPageData?: ActionResponse<Entity>;
}) => {
  const { isLoading, hasMore, nextPage, items, mutate, fetchLog } =
    useInfiniteFetch<Entity>(path, body, {
      firstPageData,
    });
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-12 ${inter.className} gap-3`}
    >
      <h1 className="text-2xl font-bold">
        Cache workaround when passing fallback to useSWRInfinite
      </h1>
      <div className="h-1/3 w-full flex flex-col">
        <h3 className="text-md font-mono font-bold">Fetch Log</h3>
        {fetchLog.map((log, i) => (
          <div key={i} className="text-xs font-mono">
            {log}
          </div>
        ))}
      </div>
      <section className="w-full">
        <h2 className="text-xl font-bold">Entities</h2>
        <div className="flex justify-around">
          <button
            disabled={!hasMore}
            onClick={nextPage}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Load More
          </button>
          <button
            disabled={!items}
            onClick={() => mutate()}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Mutate
          </button>
        </div>
        <table className="w-full pt-4 text-center border-solid">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {Boolean(items && !items.length) && (
              <tr>
                <td colSpan={2}>No entities.</td>
              </tr>
            )}
            {Boolean(items && items.length) &&
              items!.map((entity, i) => (
                <tr key={i}>
                  <td>{entity.id}</td>
                  <td>{entity.name}</td>
                  <td>{entity.timestamp}</td>
                </tr>
              ))}
            {isLoading && (
              <tr>
                <td colSpan={2}>Loading...</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
};

export default function HomeWithFirstPageData() {
  const [firstPageData, setFirstPageData] = useState<ActionResponse<Entity>>();

  const { cache, mutate } = useSWRConfig();

  useEffect(() => {
    const fetchFirstPageData = async () => {
      const response = await fetch(path, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return;

      const firstPageData = await response.json();

      // cache.set(getFirstPageKey(path, body), {
      //   data: firstPageData,
      //   // @ts-ignore
      //   _k: buildGetKey(path, body)(0, null),
      // });
      // await mutate(
      //   getFirstPageKey(path, body),
      //   { data: firstPageData },
      //   {
      //     revalidate: false,
      //     populateCache: true,
      //   }
      // );

      setFirstPageData(firstPageData);
    };
    fetchFirstPageData();
  }, [mutate, cache]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const schedule = () => {
      timeout = setTimeout(() => {
        console.log(
          Array.from(cache.keys()).map((key) => [
            key === getFirstPageKey(buildGetKey(path, body)),
            key,
            cache.get(key),
          ])
        );
        // schedule();
      }, 10000);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [cache]);

  // if (!firstPageData) return null;

  return <Home firstPageData={firstPageData} />;
}

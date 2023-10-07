import Image from "next/image";
import { Inter } from "next/font/google";
import {
  buildGetKey,
  getFirstPageKey,
  getInfiniteFirstPageKey,
  useInfiniteFetch,
} from "hooks/InfiniteFetch";
import { ActionResponse, Entity } from "pages/api/entities";
import { useCallback, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import useSWRInfinite, { unstable_serialize } from "swr/infinite";

const inter = Inter({ subsets: ["latin"] });

const path = "/api/entities";
const body = {
  action: "getEntities",
  params: { limit: 20 },
};

const getKey = (pageIndex: number, previousPage: ActionResponse | null) => {
  if (previousPage && !previousPage.nextOffset) return null;

  const offset = previousPage?.nextOffset;
  const {
    action,
    params: { limit: originalLimit, ...otherParams },
  } = body;

  return {
    path,
    body: JSON.stringify({
      action,
      params: {
        ...otherParams,
        limit: previousPage?.limit || originalLimit,
        offset, // if undefined, JSON.stringify() filters this key out.
      },
    }),
  };
};

const Minimal = ({
  firstPageData,
}: {
  firstPageData?: ActionResponse<Entity>;
}) => {
  const { mutate: globalMutate } = useSWRConfig();
  const [fetchLog, setFetchLog] = useState<string[]>([
    `firstPageData is ${firstPageData ? "" : "NOT"} set (ie: offset = 0)`,
  ]);

  let fallbackOptions;
  if (firstPageData) {
    fallbackOptions = {
      fallback: {
        [getInfiniteFirstPageKey(getKey)]: [firstPageData],
      },
    };
  }

  const {
    mutate: boundMutate,
    data,
    isLoading,
    size,
    setSize,
  } = useSWRInfinite<ActionResponse<Entity>>(
    getKey,
    async ({ path, body }) => {
      try {
        setFetchLog((fetchLog) => fetchLog.concat(`fetching...${body}`));
        const response = await fetch(path, {
          method: "POST",
          body,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error(await response.json());
        }
        return await response.json();
      } catch (error) {
        console.error(error);
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: undefined,
      revalidateIfStale: false,
      revalidateFirstPage: false,
      initialSize: 1,
      ...fallbackOptions,
    }
  );

  useEffect(() => {
    if (firstPageData) {
      boundMutate([firstPageData], {
        revalidate: false,
        populateCache: true,
      });

      globalMutate(getFirstPageKey(getKey), firstPageData, {
        revalidate: false,
        populateCache: true,
      });
    }
  }, []);

  const localMutate = useCallback(async () => {
    await boundMutate();
  }, [boundMutate]);

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
            disabled={Boolean(
              !data ||
                (data && data.length && !data[data.length - 1].nextOffset)
            )}
            onClick={() => setSize(size + 1)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Load More
          </button>
          <button
            disabled={!data}
            onClick={localMutate}
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
            {Boolean(data && data.length && !data[0].items.length) && (
              <tr>
                <td colSpan={2}>No entities.</td>
              </tr>
            )}
            {Boolean(data && data.length && data[0].items.length) &&
              data!.map(({ items }) =>
                items!.map((entity, i) => (
                  <tr key={i}>
                    <td>{entity.id}</td>
                    <td>{entity.name}</td>
                    <td>{entity.timestamp}</td>
                  </tr>
                ))
              )}
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

      // Does not set the 1st page key, so it is fetched
      // mutate(getInfiniteFirstPageKey(path, body), [firstPageData], {
      //   revalidate: false,
      //   populateCache: true,
      // });

      // Sets the right key entry and even though cache contents are not the same as
      // those when useSWRInfinite fetches the very same 1st page, combined with previous
      // infinite key mutate, works fine.
      // mutate(getFirstPageKey(path, body), firstPageData, {
      //   revalidate: false,
      //   populateCache: true,
      // });

      setFirstPageData(firstPageData);
    };
    fetchFirstPageData();
  }, [mutate]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const schedule = () => {
      timeout = setTimeout(() => {
        console.log(
          Array.from(cache.keys()).map((key) => [
            key === getFirstPageKey(getKey),
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

  if (!firstPageData) return null;

  return <Minimal firstPageData={firstPageData} />;
}

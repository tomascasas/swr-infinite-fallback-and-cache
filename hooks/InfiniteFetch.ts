import { ActionResponse, PaginatedActionRequest } from "pages/api/entities";
import { useCallback, useEffect, useMemo, useState } from "react";
import { unstable_serialize, useSWRConfig } from "swr";
import useSWRInfinite, {
  SWRInfiniteConfiguration,
  SWRInfiniteKeyLoader,
  unstable_serialize as unstable_serialize_infinite,
} from "swr/infinite";

export const getFirstPageKey = (getKey: SWRInfiniteKeyLoader) => {
  return unstable_serialize(getKey(0, null));
};

export const getInfiniteFirstPageKey = (getKey: SWRInfiniteKeyLoader) => {
  return unstable_serialize_infinite(getKey);
};

export const buildGetKey = (path: string, body: Record<string, any>) => {
  return (pageIndex: number, previousPage: ActionResponse | null) => {
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
};

const buildUseSWRInfiniteOptions = (
  options: SWRInfiniteConfiguration
): SWRInfiniteConfiguration =>
  Object.assign(
    {
      // useSWR
      errorRetryInterval: 5000,
      // errorRetryCount: undefined,
      loadingTimeout: 3000,
      focusThrottleInterval: 5000,
      dedupingInterval: 2000,

      refreshInterval: undefined,
      // refreshWhenHidden: undefined,
      // refreshWhenOffline: undefined,

      revalidateOnFocus: true,
      revalidateOnReconnect: true,

      // revalidateOnMount: undefined,
      revalidateIfStale: true,

      shouldRetryOnError: true, // boolean | ((err: Error) => boolean)

      // keepPreviousData: undefined,
      suspense: false,

      // fallbackData: undefined,
      // use: undefined, // Middleware[]
      // fallback: undefined,

      // isPaused: undefined,
      // onLoadingSlow: undefined,
      // onSuccess: undefined,
      // onError: undefined,
      // onErrorRetry: undefined,
      // onDiscarded: undefined,
      // isOnline: undefined,
      // isVisible: undefined,

      // useSWRInfinite
      initialSize: 1,
      revalidateAll: false,
      persistSize: true,
      revalidateFirstPage: true,
      parallel: false,
      // fetcher: undefined,
      // compare: undefined,
    },
    options
  );

const defaultUseSWRInfiniteOptions = buildUseSWRInfiniteOptions({
  // useSWR
  errorRetryCount: 0,
  revalidateOnMount: undefined,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,

  // useSWRInfinite
  // persistSize: true, // we may need this one to pull as many pages as we had before mutate()
  revalidateFirstPage: false,
});

type Options<T> = {
  firstPageData?: ActionResponse<T>;
};

export const useInfiniteFetch = <
  T = any,
  PAR extends PaginatedActionRequest = PaginatedActionRequest
>(
  path: string,
  body: PAR,
  options: Options<T> = {}
) => {
  const getKey = buildGetKey(path, body);

  const { mutate: globalMutate } = useSWRConfig();

  const { firstPageData } = options;
  const [fetchLog, setFetchLog] = useState<string[]>([
    `firstPageData is ${firstPageData ? "" : "NOT"} set (ie: offset = 0)`,
  ]);

  const useSWRInfiniteOptions = { ...defaultUseSWRInfiniteOptions };
  if (firstPageData) {
    useSWRInfiniteOptions.fallback = {
      [getInfiniteFirstPageKey(getKey)]: [firstPageData],
    };
  }

  const {
    isLoading,
    // isValidating, // We may consider exposing it to signal mutate has been called
    data,
    error,
    setSize: setPage,
    size: page,
    mutate: boundMutate,
  } = useSWRInfinite<ActionResponse<T>>(
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
    useSWRInfiniteOptions
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

  const items = useMemo(() => {
    return data && data.flatMap(({ items }) => items);
  }, [data]);

  const hasMore = useMemo(() => {
    if (!data) return false;
    if (data.length < page) return false;
    const { nextOffset } = data[page - 1];
    return Boolean(nextOffset);
  }, [data, page]);

  const nextPage = useCallback(() => {
    // NOTE: Do not use setPage as a state dispatcher. Initially thought
    //      setPage, ie: setSize, was a regular dispatcher which as long
    //      as you provide a Pure Function (no side effects), it would
    //      work just fine. Turns out it is a callback that will trigger
    //      a mutation on the loaded data to assess revalidation.
    return setPage(page + (hasMore ? 1 : 0));
  }, [hasMore, setPage, page]);

  const resetPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  const result = useMemo(
    () => ({
      isLoading,
      data,
      items,
      error,
      hasMore,
      page,
      nextPage,
      resetPage,
      mutate: boundMutate,
      fetchLog,
    }),
    [
      isLoading,
      data,
      items,
      error,
      hasMore,
      page,
      nextPage,
      resetPage,
      boundMutate,
      fetchLog,
    ]
  );

  return result;
};

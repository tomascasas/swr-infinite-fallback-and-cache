// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

type Params = { readonly [name: string]: any };

export type PaginationParams = {
  offset?: number;
  limit: number;
};

export type ActionRequest = {
  action: string;
  params: Params;
};

export type PaginatedActionRequest = {
  action: string;
  params: Params & PaginationParams;
};
export type ActionResponse<T = unknown> = {
  readonly items: T[];
  readonly nextOffset?: number;
  readonly limit: number;
};

export type Entity = {
  id: number;
  name: string;
  timestamp?: number;
};

const PAGE_COUNT = 3;
const PAGE_SIZE = 20;

const entityPages: Entity[][] = Array.from({ length: 3 }, (_, p) =>
  Array.from({ length: PAGE_SIZE }, (_, r) => ({
    id: p * PAGE_SIZE + r,
    name: `${p * PAGE_SIZE + r} - name`,
  }))
);

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActionResponse<Entity>>
) {
  const { offset = 0 } = req.body.params;
  let nextOffset = offset + 1;
  if (offset === PAGE_COUNT - 1) {
    nextOffset = undefined;
  }
  res.status(200).json({
    items: entityPages[offset].map((entity) => {
      entity.timestamp = Date.now();
      return entity;
    }),
    limit: 20,
    nextOffset,
  });
}

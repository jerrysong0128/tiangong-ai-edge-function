/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { Pinecone } from "npm:/@pinecone-database/pinecone@2.2.2";
import { OpenAIEmbeddings } from "npm:/@langchain/openai@0.1.1";
import { DynamicStructuredTool } from "npm:/@langchain/core@0.2.5/tools";
import { OpenSearchClient } from "npm:@aws-sdk/client-opensearch";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import { z } from "npm:/zod@3.23.8";

const pinecone_api_key = Deno.env.get("PINECONE_API_KEY") ?? "";
const pinecone_index_name = Deno.env.get("PINECONE_INDEX_NAME") ?? "";
const pinecone_namespace_esg = Deno.env.get("PINECONE_NAMESPACE_ESG") ?? "";

const openai_api_key = Deno.env.get("OPENAI_API_KEY") ?? "";
const openai_embedding_model = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "";

const pc = new Pinecone({ apiKey: pinecone_api_key });
const index = pc.index(pinecone_index_name);

const openaiClient = new OpenAIEmbeddings({
  apiKey: openai_api_key,
  model: openai_embedding_model,
});

const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')


const openSearchClient = new OpenSearchClient({ region: "REGION" });

const search = async (query: string, topK: number, filter: object) => {
  console.log(query, topK, filter);

  const searchVector = await openaiClient.embedQuery(query);
  const queryResponse = await index.namespace(pinecone_namespace_esg).query({
    vector: searchVector,
    filter: filter,
    topK: topK,
    includeMetadata: true,
  });

  if (!queryResponse) {
    console.error("doc id does not exist");
  }

  const docList = [];
  for (const doc of queryResponse.matches) {
    // const metadata = (doc as { metadata: object }).metadata;
    docList.push({ content: doc?.metadata?.text });

    // const id_set = new Set();
    // for (const doc of queryResponse.matches) {
    //   id_set.add(doc?.metadata?.rec_id);
    // }
    // const pgResponse = await postgres.query(
    //   "SELECT id, company_short_name, report_title, publication_date FROM ESG WHERE id = ANY($1)",
    //   [Array.from(id_set)],
    // );

    // const recordsDict: { [id: string]: RecordType } = {};

    // for (const record of pgResponse) {
    //   const id = record.id;
    //   recordsDict[id] = record;
    // }

    // const docList = [];
    // for (const doc of queryResponse.matches) {
    //   const metadata = (doc as { metadata: object }).metadata;
    //   const id = (metadata as { rec_id: string }).rec_id.toString();
    //   const record = recordsDict[id];

    //   if (record) {
    //     const formattedDate =
    //       new Date(record.publication_date.toString()).toISOString().split(
    //         "T",
    //       )[0];
    //     const companyShortName = record.company_short_name;
    //     const reportTitle = record.report_title;
    //     const pageNumber = doc?.metadata?.page_number;
    //     const sourceEntry =
    //       `${companyShortName}. ${reportTitle}. ${formattedDate}. (P${pageNumber})`;
    //     docList.push({ content: doc?.metadata?.text, source: sourceEntry });
    //   } else {
    //     throw new Error("Record not found");
    //   }
    // }
  }
  return docList;
};

class SearchEsgTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: "Search_ESG_Tool",
      description: "Call this tool to search the ESG database for information.",
      schema: z.object({
        query: z.string().describe("Requirements or questions from the user."),
        docIds: z.array(z.string()).default([]).describe(
          "document ids to filter the search.",
        ),
        topK: z.number().default(3).describe("Number of results to return."),
      }),
      func: async ({ query, docIds, topK }) => {
        if (!query) {
          throw new Error("Query is empty.");
        }
        if (docIds.length > 0) {
          const filter = { rec_id: { "$in": docIds } };
          const results = await search(query, topK, filter);
          return JSON.stringify(results);
        } else {
          const filter = {};
          const results = await search(query, topK, filter);
          return JSON.stringify(results);
        }
      },
    });
  }
}

export default SearchEsgTool;
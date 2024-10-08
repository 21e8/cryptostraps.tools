import React, { useEffect, useState } from "react";
import { fetchMetaForUI } from "../util/token-metadata";
import { download } from "../util/download";
import jsonFormat from "json-format";
import { useModal } from "../contexts/ModalProvider";
import { useForm } from "react-hook-form";
import { getAddresses, validateSolAddressArray } from "../util/validators";
import Head from "next/head";
import { useConnection } from "@solana/wallet-adapter-react";
import { toast } from "react-toastify";
import { useRouter } from "next/router";

export default function GetMeta() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm();
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState(0);
  const [len, setLen] = useState(0);
  const { setModalState } = useModal();
  const { connection } = useConnection();
  const {
    query: { jobName },
  } = useRouter();
  useEffect(() => setModalState({ open: false, message: "" }), [setModalState]);
  useEffect(() => {
    try {
      const localStorageItems = localStorage.getItem("user-mint-lists");
      if (localStorageItems) {
        const asObj = JSON.parse(localStorageItems);
        const items = asObj.find((obj) => obj.name === jobName)?.items;
        setValue("mints", JSON.stringify(items));
      }
    } catch (e) {
      console.log(e);
    }
  }, [jobName, setValue]);
  const fetchMeta = ({ mints }: { mints: string }) => {
    const parsed = getAddresses(mints);
    const id = toast("Downloading your data.", { isLoading: true });

    setLen(parsed.length);
    setLoading(true);
    fetchMetaForUI(parsed, setCounter, connection).subscribe({
      next: (e) => {
        download(
          `nft-metadata-${Date.now()}.json`,
          jsonFormat(e, { size: 1, type: "tab" })
        );
        setLoading(false);
      },
      error: (e) => {
        setModalState({
          message: e?.message ? e.message : "An error occurred",
          open: true,
        });
        setLoading(false);
      },
      complete: () => {
        toast.dismiss(id);
      },
    });
  };

  return (
    <div>
      <Head>
        <title>🛠️ Cryptostraps Tools - ℹ️ NFT Metadata</title>
      </Head>
      <div className="mb-3 w-full max-w-full text-center">
        <h1 className="text-3xl text-white">Token Metadata</h1>
        <hr className="my-4 opacity-10" />
      </div>
      <p className="px-2 text-center">
        This tool gives you onchain an arweave/ipfs metadata from Solana Mint
        IDs.
      </p>
      <hr className="my-4 opacity-10" />
      <div className="max-w-full bg-gray-900 card">
        <form
          onSubmit={handleSubmit(fetchMeta)}
          className="flex flex-col w-full"
        >
          <div className="card-body">
            <label htmlFor="mints" className="justify-center mb-4 label">
              Please enter SOL mint IDs to get their metadata
            </label>
            <textarea
              {...register("mints", {
                validate: validateSolAddressArray,
                required: "Field is required",
              })}
              rows={4}
              className={`textarea w-full shadow-lg ${
                !!errors?.mints && "input-error"
              }`}
              id="mints"
              name="mints"
            />
            {!!errors?.mints?.message && (
              <label className="label text-error">
                {errors?.mints?.message}
              </label>
            )}
            <div className="flex flex-col gap-3 justify-center items-center mt-6 text-center">
              {loading && (
                <div className="w-60">
                  <span>{((counter / len) * 100).toFixed(2)}%</span>
                  <progress
                    className="border progress progress-primary border-slate-700"
                    value={(counter / len) * 100}
                    max={100}
                  ></progress>
                </div>
              )}
              <button
                className={`btn btn-primary rounded-box shadow-lg ${
                  loading ? "loading" : ""}`}
                type="submit"
              >
                Get Meta
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

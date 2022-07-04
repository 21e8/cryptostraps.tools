import React, { useCallback, useEffect, useReducer } from "react";
import { useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Head from "next/head";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ShdwDrive } from "@shadow-drive/sdk";
import { StorageAccount } from "@shadow-drive/sdk/dist/types";
import { PublicKey } from "@solana/web3.js";

import { useAlert } from "../../contexts/AlertProvider";
import { sizeMB } from "../../components/file-tile";
import { ImageURI } from "../../util/image-uri";
import { FileUpload } from "../../components/file-upload";
import { useFiles } from "../../contexts/FileProvider";
import { sliceIntoChunks } from "../../util/slice-into-chunks";
import createFileList from "../../util/create-file-list";
import { TrashIcon } from "../../components/icons";
import { BalanceProvider, useBalance } from "../../contexts/BalanceProvider";

const sortStorageAccounts = (a, b) =>
  b.account.creationTime - a.account.creationTime;

const isValidUnit = (str: string) => {
  const num = parseFloat(str);
  if (isNaN(num)) {
    return false;
  }
  const unit = str.split(`${num}`)[1].toUpperCase();
  if (!["MB", "KB", "GB"].includes(unit)) {
    return false;
  }
  return true;
};
function ShdwDrivePage() {
  const initState: {
    totalFileSize: number;
    uploading: string;
    isResizing: string;
    increaseOrDecrease: "increase" | "decrease";
    uploadInProgress: boolean;
    createStorageLoading: boolean;
    shdwDrive: ShdwDrive;
    storageAccounts: { account: StorageAccount; publicKey: PublicKey }[];
    buttonsLoading: Record<string, boolean>;
    isCreatingStorageAccount: boolean;
    loading: boolean;
  } = {
    totalFileSize: 0,
    isResizing: "",
    uploadInProgress: false,
    increaseOrDecrease: "increase",
    uploading: "",
    createStorageLoading: false,
    shdwDrive: null,
    storageAccounts: [],
    buttonsLoading: {},
    isCreatingStorageAccount: false,
    loading: true,
  };
  const [state, dispatch] = useReducer(
    (
      state: typeof initState,
      action:
        | { type: "totalFileSize"; payload?: { totalFileSize: number } }
        | {
            type: "increaseOrDecrease";
            payload?: { increaseOrDecrease: "increase" | "decrease" };
          }
        | { type: "isResizing"; payload?: { isResizing: string } }
        | { type: "loading"; payload?: { loading: boolean } }
        | { type: "uploadInProgress"; payload?: { uploadInProgress: boolean } }
        | { type: "uploading"; payload?: { uploading: string } }
        | {
            type: "createStorageLoading";
            payload?: { createStorageLoading: boolean };
          }
        | { type: "shdwDrive"; payload?: { shdwDrive: ShdwDrive } }
        | {
            type: "isCreatingStorageAccount";
            payload?: { isCreatingStorageAccount: boolean };
          }
        | {
            type: "storageAccounts";
            payload?: {
              storageAccounts: {
                account: StorageAccount;
                publicKey: PublicKey;
              }[];
            };
          }
        | {
            type: "buttonsLoading";
            payload?: { buttonsLoading: Record<string, boolean> };
          }
    ) => {
      switch (action.type) {
        case "loading":
          return { ...state, loading: action.payload.loading };
        case "totalFileSize":
          return { ...state, totalFileSize: action.payload.totalFileSize };
        case "isResizing":
          return { ...state, isResizing: action.payload.isResizing };
        case "increaseOrDecrease":
          return {
            ...state,
            increaseOrDecrease: action.payload.increaseOrDecrease,
          };
        case "uploading":
          return { ...state, uploading: action.payload.uploading };
        case "uploadInProgress":
          return {
            ...state,
            uploadInProgress: action.payload.uploadInProgress,
          };
        case "storageAccounts":
          return { ...state, storageAccounts: action.payload.storageAccounts };
        case "shdwDrive":
          return { ...state, shdwDrive: action.payload.shdwDrive };
        case "isCreatingStorageAccount":
          return {
            ...state,
            isCreatingStorageAccount: action.payload.isCreatingStorageAccount,
          };
        case "createStorageLoading":
          return {
            ...state,
            createStorageLoading: action.payload.createStorageLoading,
          };
        case "buttonsLoading":
          return { ...state, buttonsLoading: action.payload.buttonsLoading };

        default: {
          throw new Error(
            "unsupported action type given on SHDW Drive reducer"
          );
        }
      }
    },
    initState
  );
  const { register, handleSubmit, getValues, reset } = useForm();
  const { setAlertState } = useAlert();
  const { connection } = useConnection();
  const { files, setFiles } = useFiles();
  const wallet = useWallet();
  const { solBalance, shdwBalance } = useBalance();

  const uploadFiles = useCallback(
    async (account: PublicKey) => {
      dispatch({
        type: "uploadInProgress",
        payload: { uploadInProgress: true },
      });
      try {
        const chunked = sliceIntoChunks(files, 5).map(createFileList);
        let counter = 1;
        for (const chunk of chunked) {
          setAlertState({
            message: (
              <div className="flex items-center">
                <button className="btn btn-ghost loading"></button> Sending{" "}
                {counter} of {chunked.length} transactions
              </div>
            ),
            open: true,
          });
          await state.shdwDrive.uploadMultipleFiles(account, chunk);
          counter++;
        }

        const storageAccounts = await state.shdwDrive.getStorageAccounts();
        dispatch({
          type: "storageAccounts",
          payload: {
            storageAccounts: storageAccounts.sort(sortStorageAccounts) as {
              account: StorageAccount;
              publicKey: PublicKey;
            }[],
          },
        });
      } catch (e) {
        setAlertState({
          message: "An error occured. Check Console for more info!",
          open: true,
          duration: 10000,
          severity: "error",
        });
        dispatch({
          type: "uploadInProgress",
          payload: { uploadInProgress: false },
        });
        return;
      }

      setAlertState({
        message: "Files successfully uploaded",
        open: true,
        duration: 10000,
        severity: "success",
      });
      setFiles([]);
      dispatch({
        type: "uploading",
        payload: { uploading: "" },
      });
      dispatch({
        type: "uploadInProgress",
        payload: { uploadInProgress: false },
      });
    },
    [state.shdwDrive, files]
  );

  useEffect(() => {
    (async () => {
      if (wallet?.publicKey) {
        const shdwDrive = await new ShdwDrive(connection, wallet).init();
        dispatch({
          type: "shdwDrive",
          payload: { shdwDrive },
        });
        const storageAccounts = await shdwDrive.getStorageAccounts();
        debugger;

        dispatch({
          type: "storageAccounts",
          payload: {
            storageAccounts: storageAccounts.sort(sortStorageAccounts) as {
              account: StorageAccount;
              publicKey: PublicKey;
            }[],
          },
        });

        dispatch({ type: "loading", payload: { loading: false } });
      }
    })();
  }, [wallet?.publicKey, connection, wallet]);

  const onSubmit = handleSubmit(
    async ({ storageAccountName, storageAccountSize }) => {
      if (!storageAccountName || !isValidUnit(storageAccountSize)) {
        return;
      }
      dispatch({
        type: "createStorageLoading",
        payload: { createStorageLoading: true },
      });
      setAlertState({
        open: true,
        message: (
          <div className="p-3">
            <button className="btn btn-ghost loading"></button>
            Storage Account &quot;{storageAccountName}&quot; is being created...
          </div>
        ),
      });
      try {
        const response = await state.shdwDrive.createStorageAccount(
          storageAccountName,
          storageAccountSize
        );
        setAlertState({
          open: false,
          message: <></>,
        });
        setAlertState({
          message: "Storage account created at " + response.shdw_bucket,
          open: true,
          duration: 3000,
          severity: "success",
        });

        reset();
        dispatch({
          type: "isCreatingStorageAccount",
          payload: { isCreatingStorageAccount: false },
        });
        setTimeout(async () => {
          const storageAccounts = await state.shdwDrive.getStorageAccounts();
          dispatch({
            type: "storageAccounts",
            payload: {
              storageAccounts: storageAccounts.sort(sortStorageAccounts) as {
                account: StorageAccount;
                publicKey: PublicKey;
              }[],
            },
          });
        }, 2000);
      } catch (e) {
        setAlertState({
          open: false,
          message: <></>,
        });
        setAlertState({
          message: "An error occured. Check Console for more info!",
          duration: 10000,
          severity: "error",
          open: true,
        });
      }
    }
  );
  const handleDeleteStorageAccount = async ({ publicKey, pubKeyString, i }) => {
    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: true,
        },
      },
    });
    try {
      const response = await state.shdwDrive.deleteStorageAccount(publicKey);
      if (response.txid) {
        setAlertState({
          message: "Storage Account is marked for deletion",
          open: true,
          duration: 3000,
        });
        const updatedArr = [...state.storageAccounts];
        updatedArr[i].account.deleteRequestEpoch =
          (await connection.getEpochInfo()).epoch + 1;

        dispatch({
          type: "storageAccounts",
          payload: {
            storageAccounts: updatedArr.sort(sortStorageAccounts),
          },
        });
      }
    } catch (e) {
      console.log(e);
    }
    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: false,
        },
      },
    });
  };

  useEffect(() => {
    dispatch({
      type: "totalFileSize",
      payload: {
        totalFileSize: files.reduce((acc, curr) => acc + curr.size, 0),
      },
    });
  }, [files]);

  const handleCancelDeleteStorageAccountRequest = async ({
    publicKey,
    pubKeyString,
    i,
  }) => {
    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: true,
        },
      },
    });
    try {
      const response = await state.shdwDrive.cancelDeleteStorageAccount(
        publicKey
      );
      setAlertState({
        message: "Storage Account delete request will be cancelled",
        duration: 3000,
        open: true,
      });

      const updatedArr = [...state.storageAccounts];
      updatedArr[i].account.deleteRequestEpoch = 0;

      dispatch({
        type: "storageAccounts",
        payload: {
          storageAccounts: updatedArr.sort(sortStorageAccounts),
        },
      });
    } catch (e) {
      setAlertState({
        message: "An error occured. Check Console for more info!",
        open: true,
        duration: 10000,
        severity: "error",
      });
      console.log(e);
    }

    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: false,
        },
      },
    });
  };

  const onStorageSizeSubmit = async ({ size, unit, publicKey }) => {
    const finalStr = `${size}${unit}`;
    try {
      setAlertState({
        message: (
          <div>
            <button className="mr-3 btn btn-ghost loading"></button>
            Sending and confirming transaction...
          </div>
        ),
        open: true,
      });
      if (state.increaseOrDecrease === "decrease") {
        await state.shdwDrive.reduceStorage(publicKey, finalStr);
        setAlertState({
          message: `Storage succssfully decreased by ${finalStr}!`,
          open: true,
          severity: "success",
        });
      }
      if (state.increaseOrDecrease === "increase") {
        await state.shdwDrive.addStorage(publicKey, finalStr);
        setAlertState({
          message: `Storage succssfully increased by ${finalStr}!`,
          open: true,
          severity: "success",
        });
      }
    } catch (e) {
      setAlertState({
        message: <></>,
        open: false,
      });
      console.error(e);
      setAlertState({
        message: "An error occured. Check Console for more info!",
        open: true,
        duration: 10000,
        severity: "error",
      });
    }
  };

  const handleResize = useCallback(
    (pubKeyString: string) =>
      dispatch({
        type: "isResizing",
        payload: {
          isResizing: state.isResizing === pubKeyString ? "" : pubKeyString,
        },
      }),
    [state.isResizing]
  );

  return (
    <>
      <Head>
        <title>🛠️ Pentacle Tools - SHDW Drive</title>
      </Head>
      <div className="mb-3 max-w-full text-center">
        <h1 className="text-4xl text-white">
          <img
            src={ImageURI.GenesysGo}
            alt=""
            className="mr-3"
            style={{
              width: 48,
              height: 48,
              display: "inline",
            }}
          />
          SHDW Drive Console
          <img
            src={ImageURI.GenesysGo}
            alt=""
            className="ml-3"
            style={{
              width: 48,
              height: 48,
              display: "inline",
            }}
          />
        </h1>
        {!!shdwBalance && (
          <div className="mt-3">
            <span className="badge badge-success">{shdwBalance} SHDW</span>
            <span className="ml-3 badge badge-primary">{solBalance} SOL</span>
          </div>
        )}
        <hr className="my-4 opacity-10" />
      </div>
      <div>
        {wallet.connected && !!state.loading && (
          <div className="w-full text-center">
            {" "}
            <button className="mx-auto btn btn-ghost loading"></button>
          </div>
        )}
        {!wallet.connected && (
          <div className="flex justify-center items-center w-full">
            <WalletMultiButton />
          </div>
        )}

        {wallet.connected && (
          <>
            <div className="p-6 max-w-full bg-gray-900 card">
              {!state.storageAccounts.length &&
                !state.isCreatingStorageAccount && (
                  <div>No storage accounts yet.</div>
                )}

              <ul>
                <li>
                  <div className="flex mb-4">
                    {state.isCreatingStorageAccount && (
                      <form
                        className="grid grid-cols-2 gap-4 mb-4"
                        onSubmit={onSubmit}
                      >
                        <input
                          type="text"
                          {...register("storageAccountName")}
                          className="w-60 input"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          {...register("storageAccountSize")}
                          className="w-60 input"
                          placeholder="Size (in kb, mb or gb, e.g. 10mb)"
                        />
                      </form>
                    )}
                    <div></div>

                    <div className="flex flex-1 gap-3 justify-end">
                      {state.isCreatingStorageAccount && (
                        <input
                          className="w-24 btn btn-success btn-sm btn-outline"
                          type="submit"
                          value={"Add"}
                          disabled={state.createStorageLoading}
                          onClick={() => {
                            onSubmit(getValues() as any);
                          }}
                        />
                      )}
                      <button
                        className={`btn btn-primary btn-sm ${
                          state.isCreatingStorageAccount ? "w-24" : ""
                        }`}
                        onClick={async () => {
                          dispatch({
                            type: "isCreatingStorageAccount",
                            payload: {
                              isCreatingStorageAccount:
                                !state.isCreatingStorageAccount,
                            },
                          });
                        }}
                        disabled={state.createStorageLoading}
                      >
                        {state.isCreatingStorageAccount
                          ? "Cancel"
                          : "Add new Storage Account"}
                      </button>
                    </div>
                  </div>
                </li>
                {state.storageAccounts.map(
                  (
                    {
                      account,
                      publicKey,
                    }: {
                      account: StorageAccount;
                      publicKey: PublicKey;
                    },
                    i
                  ) => {
                    const pubKeyString = publicKey.toBase58();

                    return (
                      <li id={pubKeyString} key={pubKeyString}>
                        <div className="flex flex-row justify-between items-center w-full">
                          <div className="flex flex-row gap-6 w-full">
                            <div className="w-full">
                              <span
                                className={`${
                                  !!account.deleteRequestEpoch && "text-red-500"
                                }`}
                              >
                                {" "}
                                <strong>{account.identifier}</strong>
                              </span>

                              {!!account.deleteRequestEpoch && (
                                <span className="text-red-500">
                                  {" "}
                                  - Will be deleted after epoch{" "}
                                  {account.deleteRequestEpoch}!
                                </span>
                              )}
                              <br />
                              <span className="my-2">
                                Created:{" "}
                                {new Date(
                                  account.creationTime * 1000
                                ).toLocaleString()}
                              </span>
                              <br />

                              <a
                                href={`https://solscan.io/account/${pubKeyString}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {pubKeyString}
                              </a>
                              <br />
                              <div className="flex w-full">
                                {!(state.uploading === pubKeyString) && (
                                  <a
                                    target="_blank"
                                    href={`/shadow-drive/files?storageAccount=${pubKeyString}`}
                                    rel="noopener noreferrer"
                                  >
                                    <button className="my-2 btn btn-sm btn-primary">
                                      See files
                                    </button>
                                  </a>
                                )}
                                <button
                                  className={`btn btn-sm m-2 ${
                                    state.uploading === pubKeyString
                                      ? "btn-error btn-outline"
                                      : "btn-primary"
                                  }`}
                                  onClick={() => {
                                    if (state.uploading === pubKeyString) {
                                      setFiles([]);
                                      dispatch({
                                        type: "isResizing",
                                        payload: {
                                          isResizing: "",
                                        },
                                      });
                                      dispatch({
                                        type: "uploading",
                                        payload: {
                                          uploading: "",
                                        },
                                      });
                                      return;
                                    }
                                    dispatch({
                                      type: "uploading",
                                      payload: {
                                        uploading: pubKeyString,
                                      },
                                    });
                                  }}
                                >
                                  {state.uploading === pubKeyString
                                    ? "Cancel Upload"
                                    : "Upload files"}
                                </button>

                                <button
                                  className={`btn btn-primary btn-sm my-2 ${
                                    state.isResizing === pubKeyString
                                      ? "btn-outline"
                                      : ""
                                  }`}
                                  onClick={() => handleResize(pubKeyString)}
                                >
                                  {state.isResizing !== pubKeyString
                                    ? "Resize"
                                    : "Cancel"}
                                </button>

                                {!account.deleteRequestEpoch &&
                                  !(state.uploading === pubKeyString) && (
                                    <button
                                      className={`btn gap-2 btn-error btn-sm ml-auto w-32 ${
                                        !!state.buttonsLoading[pubKeyString]
                                          ? "loading"
                                          : ""
                                      } `}
                                      onClick={() =>
                                        handleDeleteStorageAccount({
                                          pubKeyString,
                                          publicKey,
                                          i,
                                        })
                                      }
                                    >
                                      {!!state.buttonsLoading[pubKeyString] ? (
                                        ""
                                      ) : (
                                        <>
                                          <TrashIcon width={16} /> delete
                                        </>
                                      )}
                                    </button>
                                  )}
                                {!!account.deleteRequestEpoch && (
                                  <button
                                    className={`btn btn-error btn-sm w-32 btn-outline ml-auto ${
                                      state.buttonsLoading[pubKeyString] &&
                                      " loading"
                                    }`}
                                    onClick={() =>
                                      handleCancelDeleteStorageAccountRequest({
                                        pubKeyString,
                                        publicKey,
                                        i,
                                      })
                                    }
                                  >
                                    cancel deletion
                                  </button>
                                )}
                              </div>
                              <div>
                                {state.uploading === pubKeyString && (
                                  <FileUpload />
                                )}
                              </div>

                              {!!files.length &&
                                pubKeyString === state.uploading && (
                                  <div className="flex flex-col mb-2">
                                    <button
                                      className={`btn btn-primary btn-sm ml-auto ${
                                        state.uploadInProgress ? "loading" : ""
                                      }`}
                                      onClick={() => uploadFiles(publicKey)}
                                    >
                                      {/* @TODO */}
                                      Upload {files.length} files
                                    </button>
                                    <hr className="my-2 w-full opacity-10" />
                                  </div>
                                )}
                              <div className="badge badge-ghost">
                                Free:{" "}
                                {sizeMB(
                                  +(account.storageAvailable as any)
                                    ?.toNumber()
                                    ?.toFixed(2)
                                ).toFixed(2)}{" "}
                                MB /
                                {sizeMB(
                                  +(account.storage as any)
                                    ?.toNumber()
                                    ?.toFixed(2)
                                ).toFixed(2)}{" "}
                                MB
                              </div>
                            </div>
                          </div>
                        </div>
                        {state.isResizing === pubKeyString && (
                          <form
                            className="my-3"
                            onSubmit={handleSubmit(({ size, unit }) =>
                              onStorageSizeSubmit({ publicKey, size, unit })
                            )}
                          >
                            <h3 className="mb-2 text-xl">Storage Resize</h3>
                            <div className="flex flex-row gap-3">
                              <div className="btn-group">
                                <button
                                  className={`btn btn-sm ${
                                    state.increaseOrDecrease === "increase"
                                      ? "btn-active"
                                      : ""
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    dispatch({
                                      type: "increaseOrDecrease",
                                      payload: {
                                        increaseOrDecrease: "increase",
                                      },
                                    });
                                  }}
                                >
                                  Increase
                                </button>
                                <button
                                  className={`btn btn-sm ${
                                    state.increaseOrDecrease === "decrease"
                                      ? "btn-active"
                                      : ""
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    dispatch({
                                      type: "increaseOrDecrease",
                                      payload: {
                                        increaseOrDecrease: "decrease",
                                      },
                                    });
                                  }}
                                >
                                  Decrease
                                </button>
                              </div>
                              <div className="form-control">
                                <label className="input-group input-group-sm">
                                  <input
                                    {...register("size")}
                                    className="input input-sm"
                                    type="number"
                                    min={0}
                                  />
                                  <select
                                    {...register("unit")}
                                    className="select select-sm select-bordered"
                                  >
                                    <option disabled selected>
                                      Pick a unit
                                    </option>
                                    <option>KB</option>
                                    <option>MB</option>
                                    <option>GB</option>
                                  </select>
                                </label>
                              </div>

                              <button
                                className={`btn btn-sm btn-success btn-outline`}
                                type="submit"
                              >
                                Ok
                              </button>
                            </div>
                          </form>
                        )}
                        <progress
                          className="progress progress-primary"
                          value={account.storageAvailable / account.storage}
                        ></progress>

                        {i !== state.storageAccounts.length - 1 && (
                          <hr className="my-3 opacity-10" />
                        )}
                      </li>
                    );
                  }
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

const Wrapped = () => {
  return (
    <BalanceProvider>
      <ShdwDrivePage />
    </BalanceProvider>
  );
};

export default Wrapped;

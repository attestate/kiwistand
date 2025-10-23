import { getLocalAccount } from "./session.mjs";

let modalRef = null;
let preloadPromise = null;

// Preload the modal component
export const preloadDelegationModal = () => {
  if (!preloadPromise) {
    preloadPromise = import("./DelegationModal.jsx");
  }
  return preloadPromise;
};

export const setDelegationModalRef = (ref) => {
  modalRef = ref;
};

export const openDelegationModalForAction = () => {
  if (modalRef && modalRef.current && modalRef.current.openModalForAction) {
    modalRef.current.openModalForAction();
  } else {
    // If modal isn't ready yet, retry after a short delay
    setTimeout(() => {
      if (modalRef && modalRef.current && modalRef.current.openModalForAction) {
        modalRef.current.openModalForAction();
      }
    }, 100);
  }
};

export const isDelegationModalNeeded = (address) => {
  const localAccount = getLocalAccount(address);
  // Show delegation modal if user doesn't have a local signing key
  return !localAccount;
};
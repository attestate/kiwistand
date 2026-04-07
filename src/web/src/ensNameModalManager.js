let modalRef = null;
let preloadPromise = null;

export const preloadENSNameModal = () => {
  if (!preloadPromise) {
    preloadPromise = import("./ENSNameModal.jsx");
  }
  return preloadPromise;
};

export const setENSNameModalRef = (ref) => {
  modalRef = ref;
};

export const openENSNameModalAfterDelegation = () => {
  if (modalRef && modalRef.current && modalRef.current.openAfterDelegation) {
    modalRef.current.openAfterDelegation();
  } else {
    setTimeout(() => {
      if (modalRef && modalRef.current && modalRef.current.openAfterDelegation) {
        modalRef.current.openAfterDelegation();
      }
    }, 100);
  }
};

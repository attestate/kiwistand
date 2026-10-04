let modalRef = null;
let preloadPromise = null;

export const preloadProfileNameModal = () => {
  if (!preloadPromise) {
    preloadPromise = import("./ProfileNameModal.jsx");
  }
  return preloadPromise;
};

export const setProfileNameModalRef = (ref) => {
  modalRef = ref;
};

export const openProfileNameModalAfterDelegation = () => {
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

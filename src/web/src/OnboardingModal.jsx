import { Component } from "react";
import Modal from "react-modal";
import { getAccount } from "@wagmi/core";
import debounce from "lodash.debounce";

Modal.setAppElement("nav-onboarding-modal");

const PlusSVG = () => (
  <svg
    style={{ width: "20px", verticalAlign: "bottom" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <rect
      x="40"
      y="40"
      width="176"
      height="176"
      rx="8"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="88"
      y1="128"
      x2="168"
      y2="128"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="88"
      x2="128"
      y2="168"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
);

const ThreeDotsSVG = () => (
  <svg
    style={{ width: "20px", verticalAlign: "bottom" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <circle cx="128" cy="60" r="16" />
    <circle cx="128" cy="128" r="16" />
    <circle cx="128" cy="196" r="16" />
  </svg>
);

const ShareSVG = () => (
  <svg
    style={{ width: "20px", verticalAlign: "bottom" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M176,104h24a8,8,0,0,1,8,8v96a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V112a8,8,0,0,1,8-8H80"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <polyline
      points="88 64 128 24 168 64"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="24"
      x2="128"
      y2="136"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
);

function isSafariOnIOS() {
  const ua = navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const webkit = !!ua.match(/WebKit/i);
  const notChrome = !ua.match(/CriOS/i);
  const notEdge = !ua.match(/EdgiOS/i);
  return iOS && webkit && notChrome && notEdge;
}

function isChromeOnAndroid() {
  const ua = navigator.userAgent;
  const android = !!ua.match(/Android/i);
  const chrome = !!ua.match(/Chrome/i);
  return android && chrome;
}

function isRunningPWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone ||
    document.referrer.includes("android-app://")
  );
}

class SimpleModal extends Component {
  constructor() {
    super();
    this.state = {
      showModal: false,
      hasCheckedAccount: false,
    };
    this.checkAccountDebounced = debounce(this.checkAccount, 1000); // Debounce for 1000ms = 1s
  }

  componentDidMount() {
    this.checkAccountDebounced();
  }

  checkAccount = () => {
    const account = getAccount();
    const hasVisited =
      localStorage.getItem("-kiwi-news-has-visited") ||
      account.isConnected ||
      isRunningPWA();
    this.setState({ showModal: !hasVisited, hasCheckedAccount: true });
  };

  closeModal = () => {
    this.setState({ showModal: false });
    localStorage.setItem("-kiwi-news-has-visited", "true");
  };

  render() {
    if (!this.state.hasCheckedAccount) {
      return null; // or replace with a loading spinner or similar
    }

    const customStyles = {
      overlay: {
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 6,
      },
      content: {
        fontSize: "1.025rem",
        backgroundColor: "#e6e6df",
        border: "1px solid #ccc",
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
        borderRadius: "4px",
        outline: "none",
        padding: "20px",
        position: "absolute",
        top: "50%",
        left: "50%",
        right: "auto",
        bottom: "auto",
        marginRight: "-50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "80%",
        width: "600px",
      },
    };

    // Apply different styles for mobile
    if (window.innerWidth <= 768) {
      customStyles.content = {
        ...customStyles.content,
        top: "15%",
        left: "5%",
        right: "5%",
        transform: "none",
        width: "80%",
      };
    }

    // Apply different styles for tablet
    if (window.innerWidth <= 1024 && window.innerWidth > 768) {
      customStyles.content = {
        ...customStyles.content,
        inset: "10% 25% auto",
        top: "40%",
        left: "10%",
        right: "10%",
        width: "80%",
        transform: "none",
        maxWidth: "50%",
      };
    }

    return (
      <Modal
        isOpen={this.state.showModal}
        onRequestClose={this.closeModal}
        contentLabel="Kiwi News Modal"
        shouldCloseOnOverlayClick={true}
        style={customStyles}
      >
        <div style={{ padding: "0 5vw" }}>
          <p>
            <b style={{ fontSize: "1.2rem", marginBottom: "15px" }}>gm!</b>
            <br />
            Kiwi News is the frontpage of web3!
          </p>
          {!isChromeOnAndroid() && !isSafariOnIOS() && (
            <p>
              Here a community of crypto veterans shares and curates
              crypto-related stories from around the Internet.
              <br />
              <br />
              Click any link in the feed to see what we find interesting!
              <br />
              <br />
              Have fun!
              <br />
            </p>
          )}
          {isChromeOnAndroid() && (
            <>
              <p>
                <b>Add to home screen</b>
                <br />
                <br />
                To install the app, you need to add this website to your home
                screen.
                <br />
                <br />
                1. Tap the <ThreeDotsSVG /> Menu
                <br />
                <br />
                2. Choose "<b>Install app</b>
                "
                <br />
                <br />
                3. Open the "Kiwi News" app on your home screen
                <br />
                <br />
              </p>
            </>
          )}
          {isSafariOnIOS() && (
            <>
              <p>
                <b>Add to home screen</b>
                <br />
                <br />
                To install the app, you need to add this website to your home
                screen.
                <br />
                <br />
                1. Tap the <ShareSVG /> Share icon
                <br />
                <br />
                2. Choose "
                <b>
                  Add to Home Screen <PlusSVG />
                </b>
                "
                <br />
                <br />
                3. Open the "Kiwi News" app on your home screen
                <br />
                <br />
              </p>
            </>
          )}
        </div>
        <button
          onClick={this.closeModal}
          style={{
            borderRadius: "2px",
            padding: "5px 15px",
            border: "1px solid black",
            color: "black",
            textAlign: "center",
            textDecoration: "none",
            cursor: "pointer",
            width: "90%",
            margin: "20px auto",
            display: "block",
            fontSize: "1.1rem",
          }}
        >
          Got it 🥝
        </button>
      </Modal>
    );
  }
}

export default SimpleModal;

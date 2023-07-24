import { Component } from "react";
import Modal from "react-modal";
import { getAccount } from "@wagmi/core";
import debounce from "lodash.debounce";

Modal.setAppElement("nav-onboarding-modal");

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
      localStorage.getItem("-kiwi-news-has-visited") || account.isConnected;
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
        top: "20%",
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
        style={customStyles}
      >
        <div style={{ padding: "0 5vw" }}>
          <h2>gm!</h2>
          <p>
            <i>
              Kiwi News is <b> the frontpage of web3!</b> Here a community of
              crypto veterans shares and curates crypto-related stories from
              around the Internet.
            </i>
            <br />
            <br />
            Click any link in the feed to see what we find interesting!
            <br />
            <br />
            Have fun!
            <br />
            <br />
            🥝
          </p>
        </div>
        <button
          onClick={this.closeModal}
          style={{
            borderRadius: "2px",
            padding: "10px 15px",
            backgroundColor: "black",
            border: "1px solid black",
            color: "white",
            textAlign: "center",
            textDecoration: "none",
            cursor: "pointer",
            width: "90%",
            margin: "20px auto",
            display: "block",
            fontSize: "1.1rem",
          }}
        >
          Got it!
        </button>
      </Modal>
    );
  }
}

export default SimpleModal;

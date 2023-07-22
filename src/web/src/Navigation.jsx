import { WagmiConfig, createClient, useAccount } from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { client, chains } from "./client.mjs";
import { useEffect, useState } from "react";

import Bell from "./Bell.jsx";

const shorten = (address) =>
  address.slice(0, 6) +
  "..." +
  address.slice(address.length - 4, address.length);

const LearnMore = () => {
  const { isConnected } = useAccount();
  const [display, setDisplay] = useState(false);

  useEffect(() => {
    setDisplay(!isConnected);
  }, [isConnected]);

  return display ? (
    <div style={{ textAlign: "center", paddingRight: "4px" }}>
      <a
        href="/welcome"
        style={{ textDecoration: "underline", color: "black" }}
      >
        Learn more <br />
        about 🥝
      </a>
    </div>
  ) : null;
};

const SettingsSVG = () => (
  <svg
    style={{ width: "1.6rem", height: "1.6rem", paddingLeft: "6px" }}
    viewBox="0 0 100 100"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="m94.801 40.801-10.602-1.8008c-0.60156-1.8984-1.3984-3.6992-2.3008-5.5l6.1992-8.6992c0.89844-1.3008 0.80078-3.1016-0.30078-4.1992l-8.5-8.5c-1.1016-1.1016-2.8984-1.3008-4.1992-0.30078l-8.6992 6.1992c-1.6992-0.89844-3.6016-1.6992-5.5-2.3008l-1.6992-10.5c-0.30078-1.6016-1.6016-2.6992-3.1992-2.6992h-12c-1.6016 0-2.8984 1.1016-3.1992 2.6992l-1.8008 10.602c-1.8984 0.60156-3.6992 1.3984-5.5 2.3008l-8.6992-6.1992c-1.3008-0.89844-3.1016-0.80078-4.1992 0.30078l-8.5 8.5c-1.1016 1.1016-1.3008 2.8984-0.30078 4.1992l6.1992 8.6992c-0.89844 1.6992-1.6992 3.6016-2.3008 5.5l-10.5 1.6992c-1.6016 0.30078-2.6992 1.6016-2.6992 3.1992v12c0 1.6016 1.1016 2.8984 2.6992 3.1992l10.602 1.8008c0.60156 1.8984 1.3984 3.6992 2.3008 5.5l-6.1992 8.6992c-0.89844 1.3008-0.80078 3.1016 0.30078 4.1992l8.5 8.5c1.1016 1.1016 2.8984 1.3008 4.1992 0.30078l8.6992-6.1992c1.6992 0.89844 3.6016 1.6992 5.5 2.3008l1.8008 10.602c0.30078 1.6016 1.6016 2.6992 3.1992 2.6992h12c1.6016 0 2.8984-1.1016 3.1992-2.6992l1.6992-10.703c1.8984-0.60156 3.6992-1.3984 5.5-2.3008l8.6992 6.1992c1.3008 0.89844 3.1016 0.80078 4.1992-0.30078l8.5-8.5c1.1016-1.1016 1.3008-2.8984 0.30078-4.1992l-6.1992-8.6992c0.89844-1.6992 1.6992-3.6016 2.3008-5.5l10.602-1.8008c1.6016-0.30078 2.6992-1.6016 2.6992-3.1992v-11.898c-0.10156-1.6016-1.2031-2.8984-2.8008-3.1992zm-44.801 26.301c-9.5 0-17.102-7.6992-17.102-17.102 0-9.5 7.6992-17.102 17.102-17.102 9.3984 0 17.102 7.6016 17.102 17.102s-7.6016 17.102-17.102 17.102z" />
  </svg>
);

const ProfileSVG = () => (
  <svg
    style={{ paddingLeft: "8px", width: "1.5rem" }}
    className="icon-svg"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    viewBox="0 0 20 20"
    version="1.1"
  >
    <title>profile_round [#1342]</title>
    <desc>Created with Sketch.</desc>
    <defs></defs>
    <g
      id="Page-1"
      stroke="none"
      stroke-width="1"
      fill="none"
      fill-rule="evenodd"
    >
      <g
        id="Dribbble-Light-Preview"
        transform="translate(-140.000000, -2159.000000)"
        fill="#000000"
      >
        <g id="icons" transform="translate(56.000000, 160.000000)">
          <path
            d="M100.562548,2016.99998 L87.4381713,2016.99998 C86.7317804,2016.99998 86.2101535,2016.30298 86.4765813,2015.66198 C87.7127655,2012.69798 90.6169306,2010.99998 93.9998492,2010.99998 C97.3837885,2010.99998 100.287954,2012.69798 101.524138,2015.66198 C101.790566,2016.30298 101.268939,2016.99998 100.562548,2016.99998 M89.9166645,2004.99998 C89.9166645,2002.79398 91.7489936,2000.99998 93.9998492,2000.99998 C96.2517256,2000.99998 98.0830339,2002.79398 98.0830339,2004.99998 C98.0830339,2007.20598 96.2517256,2008.99998 93.9998492,2008.99998 C91.7489936,2008.99998 89.9166645,2007.20598 89.9166645,2004.99998 M103.955674,2016.63598 C103.213556,2013.27698 100.892265,2010.79798 97.837022,2009.67298 C99.4560048,2008.39598 100.400241,2006.33098 100.053171,2004.06998 C99.6509769,2001.44698 97.4235996,1999.34798 94.7348224,1999.04198 C91.0232075,1998.61898 87.8750721,2001.44898 87.8750721,2004.99998 C87.8750721,2006.88998 88.7692896,2008.57398 90.1636971,2009.67298 C87.1074334,2010.79798 84.7871636,2013.27698 84.044024,2016.63598 C83.7745338,2017.85698 84.7789973,2018.99998 86.0539717,2018.99998 L101.945727,2018.99998 C103.221722,2018.99998 104.226185,2017.85698 103.955674,2016.63598"
            id="profile_round-[#1342]"
          ></path>
        </g>
      </g>
    </g>
  </svg>
);
const Settings = () => {
  const { address, isConnected } = useAccount();
  const [display, setDisplay] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      setDisplay(true);
    } else {
      setDisplay(false);
    }
  }, [address, isConnected]);

  return display ? (
    <a
      href="/settings"
      style={{ color: "black", textDecoration: "none", display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="svg-container">
          <SettingsSVG />
        </div>
        Settings
      </div>
    </a>
  ) : null;
};

const Profile = () => {
  const { address, isConnected } = useAccount();
  const [display, setDisplay] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      setDisplay(true);
    } else {
      setDisplay(false);
    }
  }, [address, isConnected]);

  return display ? (
    <a
      href={"/upvotes?address=" + address}
      style={{ color: "black", textDecoration: "none", display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="svg-container">
          <ProfileSVG />
        </div>
        Profile
      </div>
    </a>
  ) : null;
};

const DisconnectSVG = () => (
  <svg
    style={{ paddingTop: "5px", width: "1.8rem" }}
    className="icon-svg"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    version="1.1"
    id="_x32_"
    viewBox="0 0 512 512"
    xml:space="preserve"
  >
    <g>
      <path
        class="st0"
        d="M210.287,176.988h-57.062c-36.544,0-67.206,24.836-76.238,58.53H0v40.973h76.987   c9.04,33.686,39.702,58.522,76.238,58.522h57.062v-38.588h43.025v-80.84h-43.025V176.988z"
      />
      <path
        class="st0"
        d="M435.005,235.517c-9.032-33.694-39.686-58.53-76.23-58.53h-57.062v158.024h57.062   c36.544,0,67.191-24.836,76.23-58.522H512v-40.973H435.005z"
      />
    </g>
  </svg>
);
const DisconnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
        const connected = account && chain && mounted;
        if (connected) {
          return (
            <div onClick={openAccountModal} className="sidebar-div">
              <div style={{ display: "flex", alignItems: "center" }}>
                <div className="svg-container">
                  <DisconnectSVG />
                </div>
                Disconnect
              </div>
            </div>
          );
        } else {
          return null;
        }
      }}
    </ConnectButton.Custom>
  );
};

const CustomConnectButton = () => {
  const buttonStyle = {
    borderRadius: "2px",
    padding: "5px 15px 5px 15px",
    backgroundColor: "black",
    border: "1px solid black",
    color: "white",
    textAlign: "center",
    textDecoration: "none",
    cursor: "pointer",
    width: "100px",
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        const connected = account && chain && mounted;
        if (connected) {
          return (
            <Bell to="/activity">
              <i class="icon">
                <svg
                  style={{ width: "25px" }}
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18.9,11.2s0-8.7-6.9-8.7-6.9,8.7-6.9,8.7v3.9L2.5,17.5h19l-2.6-2.4Z"
                    fill="none"
                    stroke="#000000"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />

                  <path
                    d="M14.5,20.5s-.5,1-2.5,1-2.5-1-2.5-1"
                    fill="none"
                    stroke="#000000"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>{" "}
              </i>
            </Bell>
          );
        } else {
          return (
            <a style={buttonStyle} onClick={openConnectModal}>
              {connected ? (
                <span style={{ color: "#828282" }}>
                  <span
                    style={{
                      color: "black",
                      marginRight: "5px",
                      display: "inline-block",
                    }}
                  ></span>
                </span>
              ) : (
                ""
              )}

              {connected ? shorten(account) : "Connect"}
            </a>
          );
        }
      }}
    </ConnectButton.Custom>
  );
};

const Connector = ({ children }) => {
  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>{children}</RainbowKitProvider>
    </WagmiConfig>
  );
};

export const ConnectedProfile = () => (
  <Connector>
    <Profile />
  </Connector>
);
export const ConnectedDisconnectButton = () => (
  <Connector>
    <DisconnectButton />
  </Connector>
);
export const ConnectedConnectButton = () => (
  <Connector>
    <CustomConnectButton />
  </Connector>
);
export const ConnectedSettings = () => (
  <Connector>
    <Settings />
  </Connector>
);
export const ConnectedLearnMore = () => (
  <Connector>
    <LearnMore />
  </Connector>
);

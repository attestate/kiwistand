import { WagmiConfig, createClient, useAccount } from "wagmi";
import { Avatar, ConnectKitProvider, ConnectKitButton } from "connectkit";
import client from "./client.mjs";
import { useEffect, useState } from 'react';

import Bell from './Bell.jsx'

const shorten = address => address.slice(0,6)+"..."+address.slice(address.length-4, address.length);

const LearnMore = () => {
  const { isConnected } = useAccount();
  const [display, setDisplay] = useState(false);
  
  useEffect(() => {
    setDisplay(!isConnected);
  }, [isConnected]);

  return display ? (
    <div style={{textAlign: "center", paddingRight: "4px"}}>
      <a href="/welcome" style={{textDecoration: "underline", color: "black"}}>
        Learn more <br />
        about 🥝
      </a>
    </div>
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
      style={{
        color: "black", 
        textDecoration: "none", 
        display: "block", 
        margin: "10px", 
        fontWeight: "bold", 
        fontSize: "16px"
      }}
    >
      <div style={{display: "flex", alignItems: "center"}}>
        <div style={{width: "24px", height: "24px", marginRight: "10px"}}>

  <svg
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
        </div>
        Profile
      </div>
    </a>
  ) : null;
};

const ConnectButton = () => {
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
    <ConnectKitButton.Custom>
      {({ isConnected, show, address }) => {

        if (isConnected) {
          return (
      <Bell to="/activity">
        <i class="icon">
          <svg style={{width:"25px"}} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
          </svg> </i>
      </Bell>

          );

        } else {
          return (
            <a style={buttonStyle} onClick={show}>
              {isConnected ? (
                <span style={{color: "#828282"}}>
                  <span style={{color: "black", marginRight: "5px", display: "inline-block"}}>
                    <Avatar name={address} size={8} radius={0} /> 
                  </span>
                </span>
              ) : ""}

              {isConnected ? shorten(address) : "Connect" }
            </a>
          );
        }}
      }
    </ConnectKitButton.Custom>
  );
};

const DisconnectButton = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show}) => {
        if (isConnected) {
          return (
            <div
              onClick={show}
              style={{
                color: "black", 
                textDecoration: "none", 
                display: "block", 
                margin: "10px", 
                fontWeight: "bold", 
                fontSize: "16px",
                cursor: "pointer"  // Add a pointer cursor
              }}
            >
              <div style={{display: "flex", alignItems: "center"}}>
                <div style={{width: "24px", height: "24px", marginRight: "10px"}}>
                  <svg
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
                </div>
                Disconnect
              </div>
            </div>
          );
        } else {
          return null;
        }
      }}
    </ConnectKitButton.Custom>
  );
};

const Connector = ({children}) => {
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        {children}
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export const ConnectedProfile = () => <Connector><Profile /></Connector>;
export const ConnectedDisconnectButton = () => <Connector><DisconnectButton/></Connector>;
export const ConnectedConnectButton = () => <Connector><ConnectButton /></Connector>;
export const ConnectedLearnMore = () => <Connector><LearnMore/></Connector>;


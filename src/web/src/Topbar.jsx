import React from 'react';

const TopBar = () => {
  const handleCloseClick = () => {
    document.getElementById('top-bar').style.display = 'none';
  };

  return (
    <>
      <style>
        {`
          #top-bar {
            top: 0;
            left: 0;
            right: 0;
            background-color: #000000;
            padding: 5px;
            display: flex;
            justify-content: space-between; // Updated this line
            align-items: center;
            box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
            z-index: 1000;
          }

          #center-content {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-grow: 1; // Added this line
          }

          #top-bar p {
            margin: 0;
            padding: 0;
            font-size: 14px;
          }

          #top-bar button {
            background-color: #3DC617;
            color: white;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
            transition: background-color 0.3s;
            margin-left: 10px;
          }

          #top-bar button:hover {
            background-color: #0056b3;
          }

          #close-button {
            cursor: pointer;
            padding: 5px;
            color: white;
          }
        `}
      </style>
      <div id="top-bar">
        <div id="center-content">
          <p>We are raising funds via Gitcoin Grants. Check it out.</p>
          <a href="https://explorer.gitcoin.co/#/round/10/0x8de918f0163b2021839a8d84954dd7e8e151326d/0x8de918f0163b2021839a8d84954dd7e8e151326d-53" target="_blank">
            <button>Go to Gitcoin</button>
          </a>
        </div>
        <span id="close-button" onClick={handleCloseClick}>X</span>
      </div>
    </>
  );
};

export default TopBar;


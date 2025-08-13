import { useState, useEffect } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";

const RewardsDrawer = () => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Add styles for the drawer
  useEffect(() => {
    const styleId = 'rewards-drawer-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .rewards-drawer-paper {
          height: calc(100% - 60px) !important;
          max-height: calc(100% - 60px) !important;
          overflow: visible !important;
          border-top-left-radius: 12px !important;
          border-top-right-radius: 12px !important;
          background: white !important;
        }
        .rewards-drawer-content {
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          background: white;
        }
        .rewards-drawer-header {
          position: sticky;
          top: 0;
          background: white;
          z-index: 10;
          padding: 16px 20px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
        }
        .rewards-drawer-close {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .rewards-drawer-close:active {
          background: rgba(0,0,0,0.1);
        }
        .rewards-drawer-body {
          padding: 0;
          background: white;
        }
        .rewards-drawer-body table {
          width: 100% !important;
          max-width: 100% !important;
        }
        .rewards-drawer-body .scaled-hnmain {
          transform: none !important;
          width: 100% !important;
        }
        .rewards-drawer-body #hnmain {
          width: 100% !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);

  // Expose open/close methods globally
  useEffect(() => {
    window.openRewardsDrawer = () => {
      setOpen(true);
      loadContent();
    };

    window.closeRewardsDrawer = () => {
      setOpen(false);
    };

    // Clean up on unmount
    return () => {
      delete window.openRewardsDrawer;
      delete window.closeRewardsDrawer;
    };
  }, []);

  const loadContent = async () => {
    if (content) return; // Already loaded
    
    setIsLoading(true);
    try {
      const response = await fetch("/community");
      const html = await response.text();
      
      // Extract just the main content from the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find the specific leaderboard content div
      const mainContent = doc.querySelector('div[style*="padding: 15px"]');
      if (mainContent) {
        // Extract just the leaderboard sections
        const sections = mainContent.innerHTML;
        
        // Wrap in a container with proper styling
        const wrappedContent = `
          <div style="padding: 15px; background: white;">
            ${sections}
          </div>
        `;
        setContent(wrappedContent);
        
        // Re-initialize the event handlers after content is loaded
        setTimeout(() => {
          initializeLeaderboardHandlers();
        }, 100);
      } else {
        // Fallback: try to get the main table content
        const table = doc.querySelector('#hnmain table');
        if (table) {
          // Find the row with the actual content
          const contentRow = table.querySelector('td > div[style*="padding"]');
          if (contentRow) {
            setContent(`<div style="padding: 15px; background: white;">${contentRow.innerHTML}</div>`);
            setTimeout(() => {
              initializeLeaderboardHandlers();
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load rewards:", error);
      setContent("<p style='padding: 20px;'>Failed to load rewards. Please try again.</p>");
    } finally {
      setIsLoading(false);
    }
  };

  const initializeLeaderboardHandlers = () => {
    // Re-attach the toggle functions that were defined in main.jsx
    
    // Initialize tab switching
    window.switchLeaderboardTab = function(tab) {
      const rewardsBtn = document.getElementById('rewards-tab-btn');
      const karmaBtn = document.getElementById('karma-tab-btn');
      const rewardsIndicator = document.getElementById('rewards-indicator');
      const karmaIndicator = document.getElementById('karma-indicator');
      const rewardsContent = document.getElementById('rewards-tab-content');
      const karmaContent = document.getElementById('karma-tab-content');
      
      if (tab === 'rewards') {
        // Activate rewards tab
        rewardsBtn.style.color = 'black';
        rewardsBtn.style.fontWeight = '600';
        karmaBtn.style.color = 'var(--visited-link)';
        karmaBtn.style.fontWeight = '400';
        if (rewardsIndicator) rewardsIndicator.style.display = 'block';
        if (karmaIndicator) karmaIndicator.style.display = 'none';
        
        rewardsContent.style.display = 'block';
        karmaContent.style.display = 'none';
      } else if (tab === 'karma') {
        // Activate karma tab
        karmaBtn.style.color = 'black';
        karmaBtn.style.fontWeight = '600';
        rewardsBtn.style.color = 'var(--visited-link)';
        rewardsBtn.style.fontWeight = '400';
        if (karmaIndicator) karmaIndicator.style.display = 'block';
        if (rewardsIndicator) rewardsIndicator.style.display = 'none';
        
        karmaContent.style.display = 'block';
        rewardsContent.style.display = 'none';
      }
    };
    
    // Function to toggle user stories
    const toggleUserStories = (userId) => {
      const storiesDiv = document.getElementById(`stories-${userId}`);
      const expandIcon = document.getElementById(`expand-${userId}`);
      
      if (storiesDiv && (storiesDiv.style.display === 'none' || !storiesDiv.style.display)) {
        storiesDiv.style.display = 'block';
        if (expandIcon) {
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      } else if (storiesDiv) {
        storiesDiv.style.display = 'none';
        if (expandIcon) {
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      }
    };

    // Function to toggle story contributors
    const toggleStoryContributors = (storyId) => {
      const contributorsDiv = document.getElementById(`contributors-${storyId}`);
      const expandIcon = document.getElementById(`expand-${storyId}`);
      
      if (contributorsDiv && (contributorsDiv.style.display === 'none' || !contributorsDiv.style.display)) {
        contributorsDiv.style.display = 'block';
        if (expandIcon) {
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      } else if (contributorsDiv) {
        contributorsDiv.style.display = 'none';
        if (expandIcon) {
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      }
    };

    // Add click handlers for expandable user rows
    document.querySelectorAll('.leaderboard-user-row.expandable-row').forEach(row => {
      row.addEventListener('click', function(e) {
        if (!e.target.closest('a') && !e.target.closest('button')) {
          const userId = this.getAttribute('data-user-id');
          if (userId) {
            toggleUserStories(userId);
          }
        }
      });
    });

    // Add click handlers for expand buttons
    document.querySelectorAll('.expand-button').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const userId = this.getAttribute('data-user-id');
        if (userId) {
          toggleUserStories(userId);
        }
      });
    });

    // Add click handlers for expandable story rows
    document.querySelectorAll('.expandable-story-row').forEach(row => {
      row.addEventListener('click', function(e) {
        if (!e.target.closest('a') && !e.target.closest('button')) {
          const storyId = this.getAttribute('data-story-id');
          if (storyId) {
            toggleStoryContributors(storyId);
          }
        }
      });
    });

    // Add click handlers for story expand buttons
    document.querySelectorAll('.story-expand-button').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const storyId = this.getAttribute('data-story-id');
        if (storyId) {
          toggleStoryContributors(storyId);
        }
      });
    });
  };

  const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      disableSwipeToOpen={true}
      PaperProps={{
        className: "rewards-drawer-paper",
        sx: {
          background: 'white',
        }
      }}
      ModalProps={{
        keepMounted: false,
      }}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
    >
      <div className="rewards-drawer-content">
        <div className="rewards-drawer-header">
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Weekly Rewards</h2>
          <button
            onClick={() => setOpen(false)}
            className="rewards-drawer-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="rewards-drawer-body">
          {isLoading ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ color: "#666" }}>Loading rewards...</p>
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </div>
      </div>
    </SwipeableDrawer>
  );
};

export default RewardsDrawer;
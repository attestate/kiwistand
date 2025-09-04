// This is mock data for a Farcaster cast, based on the usage in parser.mjs

export const mockFarcaster = {
  index: "farcaster123",
  href: "https://farcaster.xyz/user/0x12345",
  title: "This is a Farcaster cast title",
  metadata: {
    compliantTitle: "This is a Farcaster cast title",
    farcasterCast: {
        author: {
            username: "testuser",
            displayName: "Test User",
            pfp: "https://placehold.co/48x48",
        },
        text: "This is the content of the Farcaster cast.",
        embeds: [{ url: "https://placehold.co/600x338" }],
        hash: "0x1234567890abcdef",
    },
  },
  identity: "0x1234567890123456789012345678901234567890",
  displayName: "testuser.eth",
};

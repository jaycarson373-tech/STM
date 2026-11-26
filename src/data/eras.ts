// The archive. Every mint below was checked against DexScreener's token API
// before it was added (see scripts/verify-archive.mjs). No prices, market caps
// or volumes live in this file: those are fetched live and labelled with
// their source. Narratives and events are editorial and kept to month level.

export type EraYear = 2021 | 2022 | 2023 | 2024 | 2025 | 2026;

export interface ArchiveToken {
  mint: string;
  symbol: string;
  name: string;
  year: EraYear;
  /** One line on why it mattered. Editorial. */
  note: string;
}

export interface EraEvent {
  month: string; // "Nov 2022"
  title: string;
  detail: string;
}

export interface Era {
  year: EraYear;
  codename: string;
  tagline: string;
  narrative: string;
  /** Per-era accent; restrained, used for the rail, rules and charts. */
  accent: string;
  /** Visual personality key used by the CSS (texture + type treatment). */
  mood: 'phosphor' | 'frost' | 'ember' | 'neon' | 'gilded' | 'signal';
  events: EraEvent[];
}

export const ERAS: Era[] = [
  {
    year: 2021,
    codename: 'Genesis',
    tagline: 'Solana Summer',
    narrative:
      'Order books on Serum, the first Raydium pools, ape JPEGs and the first dog on the chain. Liquidity was something you added, not something you were promised.',
    accent: '#5EEAD4',
    mood: 'phosphor',
    events: [
      { month: 'Aug 2021', title: 'Degenerate Ape Academy mints', detail: 'The NFT drop that defined Solana Summer culture.' },
      { month: 'Sep 2021', title: 'The long outage', detail: 'The network halts for most of a day under bot load and restarts with validator coordination.' },
      { month: '2021', title: 'Dog money arrives', detail: 'Samoyedcoin brands itself the ambassador of Solana.' },
    ],
  },
  {
    year: 2022,
    codename: 'Winter',
    tagline: 'The cold years',
    narrative:
      'Terra collapses, then FTX takes Solana’s biggest backer down with it. By December the chain needs a joke to remember it is alive. It gets a dog.',
    accent: '#93C5FD',
    mood: 'frost',
    events: [
      { month: 'May 2022', title: 'Terra collapses', detail: 'The market-wide crash that starts the long winter.' },
      { month: 'Nov 2022', title: 'FTX falls', detail: 'Solana loses its most visible backer and much of its liquidity.' },
      { month: 'Dec 2022', title: 'BONK drops on Christmas', detail: 'Half the supply is airdropped to Solana users, builders and NFT holders.' },
    ],
  },
  {
    year: 2023,
    codename: 'Rebuild',
    tagline: 'The thaw',
    narrative:
      'BONK keeps the lights on. Airdrops return, a dog puts on a hat, and the first cats start arguing with the dogs.',
    accent: '#FCD34D',
    mood: 'ember',
    events: [
      { month: 'Nov 2023', title: 'The hat goes on', detail: 'dogwifhat launches and becomes the cycle’s mascot.' },
      { month: 'Dec 2023', title: 'Jito airdrop', detail: 'A large airdrop sends fresh liquidity back into the ecosystem.' },
    ],
  },
  {
    year: 2024,
    codename: 'Supercycle',
    tagline: 'Everyone is a launchpad',
    narrative:
      'Pump.fun turns launching into a button. Presales, burned LP by accident, AI agents with their own coins, a squirrel, a fart. The busiest year Solana memes ever had.',
    accent: '#F0ABFC',
    mood: 'neon',
    events: [
      { month: 'Jan 2024', title: 'Pump.fun launches', detail: 'Bonding-curve launches with no upfront liquidity become the default.' },
      { month: 'Jan 2024', title: 'Jupiter airdrop', detail: 'JUP lands in hundreds of thousands of wallets.' },
      { month: 'Mar 2024', title: 'The presale meta', detail: 'BOOK OF MEME and SLERF run on presales; SLERF’s deployer burns the presale allocation by mistake.' },
      { month: 'Oct 2024', title: 'Agents get coins', detail: 'Truth Terminal and Goatseus Maximus start the AI-agent meta.' },
      { month: 'Nov 2024', title: 'Justice for Peanut', detail: 'A squirrel becomes a national story and a top Solana meme.' },
    ],
  },
  {
    year: 2025,
    codename: 'Spectacle',
    tagline: 'Launchpads go to war',
    narrative:
      'A president launches a coin. Launchpads fork into AMMs, AMMs into launchpads, and the venue becomes the narrative.',
    accent: '#FDBA74',
    mood: 'gilded',
    events: [
      { month: 'Jan 2025', title: 'OFFICIAL TRUMP', detail: 'A sitting president’s memecoin launches on Solana.' },
      { month: 'Feb 2025', title: 'LIBRA', detail: 'A head-of-state-promoted token collapses within hours and becomes a scandal.' },
      { month: 'Mar 2025', title: 'PumpSwap', detail: 'Pump.fun graduates coins to its own AMM instead of Raydium.' },
      { month: 'Apr 2025', title: 'Raydium LaunchLab', detail: 'Raydium answers with its own bonding-curve launchpad.' },
      { month: 'Jul 2025', title: 'The PUMP sale', detail: 'Pump.fun sells its own token.' },
    ],
  },
  {
    year: 2026,
    codename: 'Now',
    tagline: 'The past has a future',
    narrative:
      'This era is still being written. It shows what is live: tokens launched through the Time Machine and what Solana is trading right now.',
    accent: '#A78BFA',
    mood: 'signal',
    events: [],
  },
];

export const ARCHIVE: ArchiveToken[] = [
  { year: 2021, mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', symbol: 'SAMO', name: 'Samoyed Coin', note: 'The first dog of Solana and its self-appointed ambassador.' },
  { year: 2021, mint: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh', symbol: 'COPE', name: 'COPE', note: 'Trading-call culture, tokenised, from the Solana Summer days.' },
  { year: 2022, mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', note: 'The Christmas airdrop that pulled Solana out of the FTX winter.' },
  { year: 2022, mint: 'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ', symbol: 'DUST', name: 'DUST Protocol', note: 'DeGods’ currency, from when NFTs were the economy.' },
  { year: 2023, mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', note: 'Literally a dog with a hat. The mascot of the cycle.' },
  { year: 2023, mint: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4', symbol: 'MYRO', name: 'Myro', note: 'Named after a founder’s dog; one of the first big post-winter runs.' },
  { year: 2023, mint: '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs', symbol: 'SILLY', name: 'Silly Dragon', note: 'A December dragon that never took itself seriously.' },
  { year: 2024, mint: 'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk', symbol: 'WEN', name: 'Wen', note: 'A poem, a cat and Jupiter’s first community launch.' },
  { year: 2024, mint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', symbol: 'BOME', name: 'BOOK OF MEME', note: 'The presale meta’s flagship.' },
  { year: 2024, mint: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3', symbol: 'SLERF', name: 'SLERF', note: 'The sloth whose deployer burned the presale by accident.' },
  { year: 2024, mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', symbol: 'MEW', name: 'cat in a dogs world', note: 'The cats fight back.' },
  { year: 2024, mint: '5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp', symbol: 'MICHI', name: 'michi', note: 'A cat face that became a reaction image.' },
  { year: 2024, mint: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', symbol: 'FWOG', name: 'FWOG', note: 'A frog born on Pump.fun.' },
  { year: 2024, mint: '63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9', symbol: 'GIGA', name: 'GIGACHAD', note: 'The chad, in coin form.' },
  { year: 2024, mint: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', symbol: 'GOAT', name: 'Goatseus Maximus', note: 'The coin an AI agent talked into existence.' },
  { year: 2024, mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', symbol: 'FARTCOIN', name: 'Fartcoin', note: 'A joke that refused to stay a joke.' },
  { year: 2024, mint: '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn', symbol: 'ZEREBRO', name: 'zerebro', note: 'An autonomous artist agent with a token.' },
  { year: 2024, mint: '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', symbol: 'PNUT', name: 'Peanut the Squirrel', note: 'Justice for Peanut.' },
  { year: 2024, mint: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump', symbol: 'CHILLGUY', name: 'Just a chill guy', note: 'A drawing of a guy who simply does not care.' },
  { year: 2024, mint: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', symbol: 'AI16Z', name: 'ai16z', note: 'A DAO run, in theory, by an AI agent.' },
  { year: 2025, mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', symbol: 'TRUMP', name: 'OFFICIAL TRUMP', note: 'A sitting president’s memecoin.' },
  { year: 2025, mint: 'FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P', symbol: 'MELANIA', name: 'Melania Meme', note: 'The sequel, two days later.' },
  { year: 2025, mint: 'Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk', symbol: 'USELESS', name: 'USELESS COIN', note: 'The LaunchLab-era coin that sold being useless.' },
  { year: 2025, mint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn', symbol: 'PUMP', name: 'Pump', note: 'The launchpad, launching itself.' },
];

export const YEARS: EraYear[] = [2021, 2022, 2023, 2024, 2025, 2026];
export const eraOf = (year: number) => ERAS.find((e) => e.year === year);
export const archiveFor = (year: number) => ARCHIVE.filter((t) => t.year === year);
export const archiveToken = (mint: string) => ARCHIVE.find((t) => t.mint === mint);

/** Deterministic daily relic: the same token for everyone on a given UTC day. */
export function relicOfTheDay(date = new Date()): ArchiveToken {
  const day = Math.floor(date.getTime() / 86_400_000);
  const x = Math.imul(day ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return ARCHIVE[x % ARCHIVE.length];
}

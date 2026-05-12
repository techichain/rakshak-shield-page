export const SITE_MAPS: Record<number, string> = {
  1:"1l67woSTAn-AQ4-ZVTWACs2sif86EZB1F",  // Kunnamangalam – CrashZero
  2:"1zQXcI3BvjOAwl4ohFFyHaeZcVDpGST5w",  // Teen Imli – Nationpath
  3:"1ISOZTr1g-Ha8GbNbeEjsXgH9zCQkxK5U",  // NH-27 Boragaon – Bihari Genda
  4:"1zBof39iEFds30FsBx-8aAgNbGhzHJhk3",  // Tejaji Nagar – Visioneers
  5:"15KxW3s04xWZ-n2vBAqxVn8TExNEBOugA",  // Kamta Chauraha – PATHRAKSHAK
  6:"1MmfQwfCPePXJewszUbhSgNUgsZr5ythY",  // IIT Delhi ORR – ZeroCollision
  7:"1646wBOoiaqULNnm86-99tOFiR6-owjMc",  // AEC Road Turn – Tratah
  8:"16swRFjslli_11XD0SN4bDwvEOdFO0ItL",  // Roorkee-Manglaur – AP
  9:"1aM7gW7mJuFkxDcLOKQlxF5DN2ocxCHfA",  // Akurli Underpass – Vision Zero Squad
  10:"1gijbcRAp5WQMJMpRmwdCPyYqp9U15LjI", // Chevayur – Civillians AKA
  11:"139VjX2qGF3f-MUwuPT-thDQGUod8nVLm", // Gilat Bazar – FTW
  13:"1134qI7PeFLlfNDkKlTDiC9gzM0BrAPig", // IT Park Chowk – Plannerloki
  14:"16leY6j_mUpluXfUZY-KX5nP0Zi6zLFMg", // Calicut Medical – Safe Grid
  15:"1d9hDRCFZ6S1SIPwDB2NhP6bugclQdmzJ", // NH-65 Rythu – Shaunak's Team
  16:"1HJHaA_fQCFPbBM-rZOG4wBzvyU0Xth1O", // RK Mission – Raksha Vahini
  17:"1U-b-26_3K9kqWF0o0ciRgqShS-y6v2ZT", // Britannia Chowk – Warriors
  18:"1cGNKW3fOP-fengy_Dp0Vu4gqTU_o_C0A", // Gurubagh Bhelupur – Work Wizards
  19:"1VpZFLcxyDY6DJspYERo6OvPUf1vMtiFk", // Chuttugunta – Team Vignan
  20:"17LXLFTCiijRj17IwANSNmmaDRTAn2iIg", // IIT BHU Gate – CrashCrackers
  21:"1LjQuAzYtGJxhHYcUmob1OSxspGA2jdYD", // TIDEL Park OMR – Saviour
  22:"1-nIsGE6TWDkUS3pAKjMhr-4n2EA-hEzl", // Rau Gol Square – No Crash Zone
  23:"14s9o4B5vt-S5DjlS7E-tIn0i2zS_5fZZ", // Gandhi More – SURAKSHA
  24:"1SBVots7tUkjH9ag9XkJfUwzWNcKTMLFu", // Bhagwanpur Mod – Pavement Pioneers
  25:"1U4HJEpeLwIjjYGpBSlOqe9dxP6DWg0eN", // Bhagat Singh Marg – VisionSafe
  26:"1-vAvmEFS-U0wG8OrMwy9uV2p1qNW31gJ", // Sardar Patel IIT – Zodiac
  27:"1S6x4mtRqnJZ40ue9HWUmXQoZWw1kNGda", // Y-Bifurcation – U-Turners
  28:"1MBRNseXLvjXNT3dVvSvB7IbIXONz96oc", // Taramani Gate – Sentinels
  30:"10y8AGEfmf-_mi-fJY7MpMZjS9fwAa0LL", // Surjit Chowk
};
export function getSiteMapUrl(id: number): string | null {
  const fid = SITE_MAPS[id];
  return fid ? `https://drive.google.com/thumbnail?id=${fid}&sz=w800` : null;
}

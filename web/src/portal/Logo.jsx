import React, { useState } from 'react';
import { LOGO } from './data';
// Pentarch logo, with a text wordmark if the image cannot load (no network)
export default function Logo() {
  const [bad, setBad] = useState(false);
  return bad ? <span className="pp-wordmark">PENTARCH</span> : <img src={LOGO} alt="Pentarch" onError={() => setBad(true)} />;
}

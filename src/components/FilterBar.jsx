import React from 'react';
import { currencies } from '../data/constants.js';
export function FilterBar({ properties = [], owners = [] }) {
  return <div className="filter-bar"><select><option>All properties</option>{properties.map((p) => <option key={p.id}>{p.name}</option>)}</select><select><option>Last 30 days</option><option>This month</option><option>Last quarter</option></select><select>{currencies.map((c) => <option key={c}>{c}</option>)}</select><select><option>All owners</option>{owners.map((o) => <option key={o.id}>{o.name}</option>)}</select><select><option>All cities</option>{[...new Set(properties.map((p) => p.city))].map((city) => <option key={city}>{city}</option>)}</select><select><option>All platforms</option><option>Airbnb</option><option>Direct</option><option>Booking.com</option><option>Long-term</option></select></div>;
}

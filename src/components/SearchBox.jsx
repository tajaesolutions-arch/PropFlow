import React from 'react';
import { Search } from 'lucide-react';
export function SearchBox({ placeholder = 'Search properties, bookings, guests, work orders, owners, reports...' }) {
  return <label className="search-box"><Search size={16} /><input placeholder={placeholder} /></label>;
}

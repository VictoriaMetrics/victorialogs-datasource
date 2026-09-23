import { createContext, useContext } from 'react';

import { getTimeZone } from '@grafana/data';
import { TimeZone } from '@grafana/schema';

/** The time zone picked in the drawer's time picker, read by every chart and logs panel it renders */
export const DrilldownTimeZoneContext = createContext<TimeZone | undefined>(undefined);

/** Returns the drawer's time zone, falling back to the user's default one outside the drawer */
export const useDrilldownTimeZone = (): TimeZone => useContext(DrilldownTimeZoneContext) ?? getTimeZone();

import React from 'react';
import type {VisualKind} from '../schema';
import {Ctx} from './kit';
import {ArrowDown, ArrowUp, Bulb, Calendar, Cash, Check, ChartDown, ChartUp, Clock, Coins, CreditCard, Document, Bank, Car, House, Hourglass, Jar, Lock, Magnifier, People, Percent, Phone, Piggy, Question, Receipt, Scale, Shield, Target, Wallet, Warning} from './arts';

export const ART: Record<VisualKind, React.FC<Ctx>> = {
  credit_card: CreditCard, coins: Coins, jar: Jar, house: House, car: Car, bank: Bank, piggy: Piggy, calendar: Calendar, clock: Clock, percent: Percent, shield: Shield, magnifier: Magnifier, receipt: Receipt, document: Document,
  arrow_up: ArrowUp, arrow_down: ArrowDown, scale: Scale, people: People, phone: Phone, chart_up: ChartUp, chart_down: ChartDown, bulb: Bulb, wallet: Wallet, cash: Cash, lock: Lock, question: Question, warning: Warning, check: Check, target: Target, hourglass: Hourglass,
};

/** One illustration. t = seconds since it should appear (negative/0 = hidden/start). */
export const Illustration: React.FC<{kind: VisualKind; size: number; t: number; accent: string; style?: React.CSSProperties}> = ({kind, size, t, accent, style}) => {
  const Art = ART[kind];
  return <svg viewBox="0 0 200 200" width={size} height={size} style={{overflow: 'visible', ...style}}><Art t={Math.max(0, t)} accent={accent} /></svg>;
};
export {pickVisuals} from './pick';

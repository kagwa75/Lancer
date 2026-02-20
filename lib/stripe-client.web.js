import { useStripe as useStripeMock } from "./stripe-mock";

export const useStripe = useStripeMock;
export const StripeProvider = ({ children }) => children ?? null;

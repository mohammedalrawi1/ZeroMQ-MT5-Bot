void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
//---
   static int counter=0;   // counter of OnTradeTransaction() calls
   static uint lasttime=0; // time of the OnTradeTransaction() last call
//---
   uint time=GetTickCount();
//--- if the last transaction was performed more than 1 second ago,
   if(time-lasttime>1000)
     {
      counter=0; // then this is a new trade operation, an the counter can be reset
      if(IS_DEBUG_MODE)
         Print(" New trade operation");
     }
   lasttime=time;
   counter++;
   Print(counter,". ",__FUNCTION__);
//--- result of trade request execution
   ulong            lastOrderID   =trans.order;
   ENUM_ORDER_TYPE  lastOrderType =trans.order_type;
   ENUM_ORDER_STATE lastOrderState=trans.order_state;
//--- the name of the symbol, for which a transaction was performed
   string trans_symbol=trans.symbol;
//--- type of transaction
   ENUM_TRADE_TRANSACTION_TYPE  trans_type=trans.type;
   switch(trans.type)
     {
      case  TRADE_TRANSACTION_POSITION:   // position modification
        {
         ulong pos_ID=trans.position;
         PrintFormat("MqlTradeTransaction: Position  #%I64u %s modified: SL=%.5f TP=%.5f",
                     pos_ID,trans_symbol,trans.price_sl,trans.price_tp);
        }
      break;
      case TRADE_TRANSACTION_REQUEST:     // sending a trade request
         PrintFormat("MqlTradeTransaction: TRADE_TRANSACTION_REQUEST");
         break;
      case TRADE_TRANSACTION_DEAL_ADD:    // adding a trade
        {
         ulong          lastDealID   =trans.deal;
         ENUM_DEAL_TYPE lastDealType =trans.deal_type;
         double        lastDealVolume=trans.volume;
         //--- Trade ID in an external system - a ticket assigned by an exchange
         string Exchange_ticket="";
         if(HistoryDealSelect(lastDealID))
            Exchange_ticket=HistoryDealGetString(lastDealID,DEAL_EXTERNAL_ID);
         if(Exchange_ticket!="")
            Exchange_ticket=StringFormat("(Exchange deal=%s)",Exchange_ticket);
 
         PrintFormat("MqlTradeTransaction: %s deal #%I64u %s %s %.2f lot   %s",EnumToString(trans_type),
                     lastDealID,EnumToString(lastDealType),trans_symbol,lastDealVolume,Exchange_ticket);
        }
      break;
      case TRADE_TRANSACTION_HISTORY_ADD: // adding an order to the history
        {
         //--- order ID in an external system - a ticket assigned by an Exchange
         string Exchange_ticket="";
         if(lastOrderState==ORDER_STATE_FILLED)
           {
            if(HistoryOrderSelect(lastOrderID))
               Exchange_ticket=HistoryOrderGetString(lastOrderID,ORDER_EXTERNAL_ID);
            if(Exchange_ticket!="")
               Exchange_ticket=StringFormat("(Exchange ticket=%s)",Exchange_ticket);
           }
         PrintFormat("MqlTradeTransaction: %s order #%I64u %s %s %s   %s",EnumToString(trans_type),
                     lastOrderID,EnumToString(lastOrderType),trans_symbol,EnumToString(lastOrderState),Exchange_ticket);
        }
      break;
      default: // other transactions  
        {
         //--- order ID in an external system - a ticket assigned by Exchange
         string Exchange_ticket="";
         if(lastOrderState==ORDER_STATE_PLACED)
           {
            if(OrderSelect(lastOrderID))
               Exchange_ticket=OrderGetString(ORDER_EXTERNAL_ID);
            if(Exchange_ticket!="")
               Exchange_ticket=StringFormat("Exchange ticket=%s",Exchange_ticket);
           }
         PrintFormat("MqlTradeTransaction: %s order #%I64u %s %s   %s",EnumToString(trans_type),
                     lastOrderID,EnumToString(lastOrderType),EnumToString(lastOrderState),Exchange_ticket);
        }
      break;
     }
//--- order ticket    
   ulong orderID_result=result.order;
   string retcode_result=GetRetcodeID(result.retcode);
   if(orderID_result!=0)
      PrintFormat("MqlTradeResult: order #%d retcode=%s ",orderID_result,retcode_result);
//---   
  }
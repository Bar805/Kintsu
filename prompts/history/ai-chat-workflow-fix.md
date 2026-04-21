There are several problems when I tried to test the app.

1. Each AI inner thought work flow requires 7 LLM calls. This might create lag when users are chatting frequently. One solution could be when determining whether to speak (selection phase), fetch the chat history again to see if 2 users have any new messages and include those into consideration.

1. LLM refers to user as different pronoun. For example, a male and a female are chatting together and the AI refers to the male with a "she". I suspect the user metadata are not well formatted in the cognitive workflow such that AI is aware of them.

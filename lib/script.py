import json
import asyncio
import argparse
from pyhon import Hon

async def auth():
    parser = argparse.ArgumentParser(description="Simple argument parsing example without prefixes")
    
    # Přidání pozičních argumentů
    parser.add_argument('email', type=str, help='Your hOn email')
    parser.add_argument('password', type=str, help='Your hOn password')
    
    # Parsování argumentů
    args = parser.parse_args()

    async with Hon(args.email, args.password) as hon:
        command_queue = []
        
        async def external_command_producer():
            while True:
                # Simulace nějakého externího příkazu, který se přidává do fronty
                command = input("")
                if command == 'exit':
                    break

                commands = command.split()
                command_queue.append(commands)

                timer = 6
                if commands[1] == 'info':
                    timer = 0.1
                await asyncio.sleep(timer)  # Zde můžete nastavit odpovídající časový interval

        async def process_commands():
            while True:
               
                if command_queue:
                    stdoutput = command_queue.pop(0)
                    mac_address = stdoutput[0]
                    command = stdoutput[1]
                    
                    for appliance in hon.appliances:
                        if appliance.unique_id == mac_address:

                            if command == 'info':
                                tempIndoor = str(appliance.attributes['parameters']['tempIndoor'])
                                tempSel = str(appliance.attributes['parameters']['tempSel'])
                                onOffStatus = str(appliance.attributes['parameters']['onOffStatus'])
                                mode = str(appliance.attributes['parameters']['machMode'])

                                print(json.dumps({
                                    "unique_id": appliance.unique_id,
                                    "tempIndoor": tempIndoor,
                                    "tempSel": tempSel,
                                    "onOffStatus": onOffStatus,
                                    "mode": mode
                                }))


                            if command == 'set_temp':
                                set_temp_command = appliance.commands["settings"]
                                set_temp_command.settings['tempSel'].value = stdoutput[2]
                                await set_temp_command.send()
                                print(json.dumps({
                                    "unique_id": appliance.unique_id,
                                    "message": "command_send"
                                }))

                            if command == 'stop':
                                final_command = appliance.commands["stopProgram"]
                                await final_command.send()
                                print(json.dumps({
                                    "unique_id": appliance.unique_id,
                                    "message": "command_send"
                                }))

                            if command == 'start':
                                mode = stdoutput[2]
                                start_command = appliance.commands["startProgram"]

                                mach_mode = start_command.settings['machMode'].values[0] #auto mode
                                if(mode == 'heating'):
                                    mach_mode = start_command.settings['machMode'].values[3]
                                if(mode == 'cooling'):
                                    mach_mode = start_command.settings['machMode'].values[1]

                                start_command.settings['machMode'].value = mach_mode
                                await start_command.send()
                                print(json.dumps({
                                    "unique_id": appliance.unique_id,
                                    "message": "command_send"
                                }))
                await asyncio.sleep(0.1)     
        
        devices = []
        for appliance in hon.appliances:
            if appliance.appliance_type == 'AC':
                devices.append({"unique_id": appliance.unique_id, "nick_name": appliance.nick_name})
        
        print(json.dumps(devices))
        await asyncio.gather(external_command_producer(),process_commands())
asyncio.run(auth())


# mac_address command


# AUTO -  start_command.settings['machMode'].values[0]
                    # CHlazení - start_command.settings['machMode'].values[1]
                    # odvlhčování - start_command.settings['machMode'].values[2]
                    # topení - start_command.settings['machMode'].values[3]
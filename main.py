import os.path
import requests
import re
from bs4 import BeautifulSoup
from requests.exceptions import RequestException
import socket
import time
#GET LINKS ----> CHECK IF THEY ARE VALID -----> CHECK IF CONTENT IS EXIST -----> IF DELETED SEND EMAIL ------>
#First check if file exists.

menu = """
██████╗  █████╗  ██████╗██╗  ██╗██╗     ██╗███╗   ██╗██╗  ██╗     ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗███████╗██████╗ 
██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██║     ██║████╗  ██║██║ ██╔╝    ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝██╔════╝██╔══██╗
██████╔╝███████║██║     █████╔╝ ██║     ██║██╔██╗ ██║█████╔╝     ██║     ███████║█████╗  ██║     █████╔╝ █████╗  ██████╔╝
██╔══██╗██╔══██║██║     ██╔═██╗ ██║     ██║██║╚██╗██║██╔═██╗     ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗ ██╔══╝  ██╔══██╗
██████╔╝██║  ██║╚██████╗██║  ██╗███████╗██║██║ ╚████║██║  ██╗    ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗███████╗██║  ██║
╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝     ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝                                                                                               
"""
print(menu)
input("PRESS ENTER TO CHECK YOUR LINKS!")
fileDirectoryValidlinks = "./validlinks.txt"
fileDirectory = "./links.txt"
fileDirectoryDeletedlink = "./deletedlinks.txt"
fileDirectoryBacklink = "backlinks.txt"
fileObject = open(fileDirectory,"r+",encoding="utf-8")
fileObjectBacklink = open(fileDirectoryBacklink,"r+",encoding="utf-8")
fileObjectDeletedBacklink = open(fileDirectoryDeletedlink,"r+",encoding="utf-8")
if not os.path.exists(fileDirectoryValidlinks):
    fileObjectValidlinks = open(fileDirectoryValidlinks, "w")
else:
    fileObjectValidlinks=  open(fileDirectoryValidlinks,"r+")
        
       

linkList = [] #Links from txt file.
notWorkingLinks = [] #Links which is not working
ourLinks = [] #backlink links
deletedBacklinks = [] #deleted backlinks
validLinks = [] #valid links

checkEmpty = os.path.getsize(fileDirectory) == 0
checkEmptyBacklink = os.path.getsize(fileDirectoryBacklink) == 0

def getLinks():
    if checkEmpty:
        print("File is empty please add some links.")
    else:
        for files in fileObject:
            linkList.append(files.strip())
    if checkEmptyBacklink:
        print("File is empty please add your backlinks.")
    else:
        for file in fileObjectBacklink:
            ourLinks.append(file.strip())
        
def checkLinks():
    #Checks for valid links.
    tempList = []
    for link in linkList[::-1]:     
        try:
            response = requests.get(link,timeout=10,allow_redirects=True)
            responseCode = response.status_code
            response.raise_for_status()
            content_type = response.headers.get('Content-Type', '').lower()
            if 'text/html' in content_type:
                if responseCode == 200:
                    print(f"Website is existing.Checking for content: {link}")
                    #Web site exists. Check content.
                    try:
                        #Parse the content
                        bsObj = BeautifulSoup(response.content.decode(response.encoding, errors='ignore'), 'html.parser')
                        #Check for noindex meta tag
                        if not bsObj.findAll('meta', content=re.compile("noindex")):  
                            #Check for specific links
                            backlinks_found = []
                            time.sleep(0.45)
                            for pattern in ourLinks:
                                if bsObj.find('a', href=re.compile(pattern)):
                                    backlinks_found.append(pattern)
                                    continue
                                for scriptTag in bsObj.find_all('script'):
                                    if scriptTag.string and re.search(pattern,scriptTag.string):
                                        backlinks_found.append(pattern)
                                        break
                        
                            if backlinks_found:
                                print(f"Backlinks found on {link}: {', '.join(backlinks_found)}")
                                validLinks.append(link)
                            else:
                                print(f"No backlinks found on {link}.")
                                deletedBacklinks.append(link)
                                tempList.append(link)          
                        else:
                            print(f"Noindex found on {link}. Status Code: {responseCode}")
                    except socket.gaierror as se:
                        print(f"{link} is not valid link. {se}")
                    except requests.exceptions.ConnectionError as ce:
                        print(f"{link} is not valid link. Removing... Error : {ce}")
                        tempList.append(link)

                    except Exception as parse_error:
                        print(f"Error processing content for {link}: {parse_error}")
                
                    
            else:
                print(f"Website {link} is not valid. Status Code: {responseCode}")
                notWorkingLinks.append(link)
                tempList.append(link)
        except RequestException as ree:
            print(f"Unexpected error please check link:{link} \n{ree}")
            notWorkingLinks.append(link)
            tempList.append(link) 
        except requests.exceptions.Timeout:
            print(f"Request timed out for {link}. Removing from list.")
            notWorkingLinks.append(link)
            tempList.append(link)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {link}: {e}")
            notWorkingLinks.append(link)
            tempList.append(link)
        except IndexError:
            print('You dont have any valid links.')
    for link in tempList:
        linkList.remove(link)

def resetFile():
    fileObject.truncate(0)
    fileObject.seek(0)
    fileObjectDeletedBacklink.truncate(0)
    fileObjectDeletedBacklink.seek(0)

def editFile():
    fileObjectValidlinks.seek(0) 
    existing_valid_links = set(fileObjectValidlinks.read().splitlines())
    new_valid_links = []
    for link in validLinks:
        if link not in existing_valid_links:
            new_valid_links.append(link)
    if new_valid_links:
        fileObjectValidlinks.seek(0, os.SEEK_END)
        for link in new_valid_links:
            fileObjectValidlinks.write(link + "\n")

    fileObjectDeletedBacklink.seek(0)
    existing_deleted_links = set(fileObjectDeletedBacklink.read().splitlines())
    new_deleted_links = []
    for link in deletedBacklinks:
        if link not in existing_deleted_links:
            new_deleted_links.append(link)
    if new_deleted_links:
        fileObjectDeletedBacklink.seek(0, os.SEEK_END)
        for link in new_deleted_links:
            fileObjectDeletedBacklink.write(link + "\n")
            
    #remove links in links.txt which no working 

            
        

if __name__ == "__main__":
    try:
        while(True):
            getLinks()
            if linkList and ourLinks:
                checkLinks()
                editFile()
            else:
                print("No valid links or backlink patterns to check.")
                break
            
    except KeyboardInterrupt:
        pass
fileObject.close()
fileObjectBacklink.close()
fileObjectDeletedBacklink.close()
fileObjectValidlinks.close()
#Summary
print("\nSummary:")
print(f"Valid Links Checked: {len(linkList)}")
print(f"Deleted Backlinks: {deletedBacklinks}")
print(f"Not Working Links: {len(notWorkingLinks)} - {notWorkingLinks}")

